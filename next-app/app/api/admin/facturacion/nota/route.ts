// ─── POST /api/admin/facturacion/nota ─────────────────────────────────
// Helper for Nota de Crédito (03) and Nota de Débito (02). Looks up the
// original fe_documento, auto-fills InformacionReferencia, and emits
// the new document with the same lineas (possibly subset/edited).
//
// Body:
//   {
//     original_documento_id: string,            // fe_documentos.id of the doc being corrected
//     tipo: '02' | '03',
//     codigo_referencia: string,                // '01' Anula, '02' Corrige texto, etc.
//     razon: string,
//     lineas?: EmitInvoiceRequest['lineas']     // omit to copy from original
//   }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { emitirDocumento } from '@/lib/facturacion/services/invoice-service';
import { linkFeDocumentoToInvoice } from '@/lib/services/invoices';
import { DEFAULT_BRANCH_ID } from '@/lib/services/feConfig';
import type {
    EmitInvoiceRequest,
    EmisorReceptor,
    TipoCedula,
    TipoDocumento
} from '@/lib/facturacion/types';

const ADMIN_EMAIL = 'ulogisticcr@gmail.com';
export const maxDuration = 60;

interface Body {
    original_documento_id?: string;
    tipo?: '02' | '03';
    codigo_referencia?: string;
    razon?: string;
    lineas?: EmitInvoiceRequest['lineas'];
    payment_term_days?: number;
}

export async function POST(req: NextRequest) {
    // Auth
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    if ((user.email || '').trim().toLowerCase() !== ADMIN_EMAIL)
        return NextResponse.json({ error: 'sólo admin' }, { status: 403 });

    let body: Body;
    try {
        body = (await req.json()) as Body;
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    if (!body.original_documento_id)
        return NextResponse.json({ error: 'original_documento_id requerido' }, { status: 400 });
    if (body.tipo !== '02' && body.tipo !== '03')
        return NextResponse.json({ error: 'tipo debe ser 02 o 03' }, { status: 400 });
    if (!body.codigo_referencia)
        return NextResponse.json({ error: 'codigo_referencia requerido' }, { status: 400 });
    if (!body.razon)
        return NextResponse.json({ error: 'razon requerida' }, { status: 400 });

    const admin = createAdminClient();

    // 1. Load the original fe_documento
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feDocs = (admin as any).from('fe_documentos');
    const { data: original, error: origErr } = await feDocs
        .select(
            'id, branch_id, order_id, clave, consecutivo, tipo_documento, fecha_emision, receptor_cedula, receptor_nombre, total_comprobante, total_impuesto, condicion_venta, medio_pago'
        )
        .eq('id', body.original_documento_id)
        .single();
    if (origErr || !original) {
        return NextResponse.json(
            { error: 'documento original no encontrado' },
            { status: 404 }
        );
    }

    // 2. Either reuse the original's lineas (default: copy via fe_lineas)
    // or take an explicit override from the body.
    let lineas: EmitInvoiceRequest['lineas'] = body.lineas ?? [];
    if (lineas.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const feLineas = (admin as any).from('fe_lineas');
        const { data: rows, error: linesErr } = await feLineas
            .select('*')
            .eq('documento_id', body.original_documento_id)
            .order('numero_linea');
        if (linesErr || !rows || rows.length === 0) {
            return NextResponse.json(
                { error: 'el documento original no tiene líneas para copiar' },
                { status: 400 }
            );
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lineas = (rows as any[]).map((r) => ({
            codigo_cabys: String(r.codigo_cabys || ''),
            detalle: String(r.detalle || ''),
            cantidad: Number(r.cantidad),
            precio_unitario: Number(r.precio_unitario),
            unidad_medida: String(r.unidad_medida || 'Unid'),
            descuento:
                r.monto_descuento && Number(r.monto_descuento) > 0
                    ? {
                          monto: Number(r.monto_descuento),
                          naturaleza: String(r.naturaleza_descuento || 'Ajuste')
                      }
                    : undefined,
            impuesto: r.codigo_tarifa
                ? {
                      codigo_tarifa: r.codigo_tarifa,
                      tarifa: Number(r.tarifa ?? 13)
                  }
                : { codigo_tarifa: '08', tarifa: 13 }
        }));
    }

    // 3. Receptor: rehydrate minimally from the original (admin can supply
    // a richer one via lineas/receptor in body if needed in F5).
    let receptor: EmisorReceptor | undefined;
    if (original.receptor_cedula) {
        const cedula = String(original.receptor_cedula);
        const tipo = (cedula.length <= 9 ? '01' : '02') as TipoCedula;
        receptor = {
            nombre: String(original.receptor_nombre || ''),
            tipo_identificacion: tipo,
            numero_identificacion: cedula
        };
    }

    const request: EmitInvoiceRequest = {
        branch_id: original.branch_id || DEFAULT_BRANCH_ID,
        order_id: original.order_id || undefined,
        tipo_documento: body.tipo,
        receptor,
        condicion_venta: original.condicion_venta || '01',
        medio_pago: Array.isArray(original.medio_pago)
            ? original.medio_pago
            : ['01'],
        lineas,
        // Required for NC/ND: point at the original.
        referencia: {
            tipo_doc: original.tipo_documento as TipoDocumento,
            numero: original.clave,
            fecha_emision: original.fecha_emision,
            codigo: body.codigo_referencia,
            razon: body.razon.slice(0, 180)
        }
    };

    const result = await emitirDocumento(request);

    // Link to invoices (NC writes a negative receivable row).
    if (result.success && result.documento_id && request.order_id) {
        try {
            const subtotal = lineas.reduce(
                (s, l) => s + l.cantidad * l.precio_unitario,
                0
            );
            const ivaAmount = lineas.reduce((s, l) => {
                const t = (l.impuesto?.tarifa ?? 0) / 100;
                return s + l.cantidad * l.precio_unitario * t;
            }, 0);
            const total = subtotal + ivaAmount;
            const { data: order } = await admin
                .from('orders')
                .select('company_id')
                .eq('id', request.order_id)
                .maybeSingle();
            if (order?.company_id) {
                await linkFeDocumentoToInvoice(admin, {
                    feDocumentoId: result.documento_id,
                    orderId: request.order_id,
                    companyId: order.company_id,
                    total,
                    ivaAmount,
                    subtotal,
                    tipoDocumento: body.tipo,
                    consecutivo: result.consecutivo || '',
                    paymentTermDays: body.payment_term_days
                });
            }
        } catch (linkErr) {
            console.error('[FE nota route] Linking failed:', linkErr);
        }
    }

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
