// ─── POST /api/admin/facturacion/recibidas/[id]/respond ──────────────
// Emits a Mensaje Receptor (10) acknowledging a supplier's invoice.
// Body: { codigo: '1' | '2' | '3', detalle?: string }
//   1 = aceptado, 2 = aceptado parcial, 3 = rechazado.
// Updates the inbound row's estado_acuse + mensaje_receptor_id link.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { emitirDocumento } from '@/lib/facturacion/services/invoice-service';
import { DEFAULT_BRANCH_ID } from '@/lib/services/feConfig';
import type {
    EmitInvoiceRequest,
    EmisorReceptor,
    TipoCedula
} from '@/lib/facturacion/types';

const ADMIN_EMAIL = 'ulogisticcr@gmail.com';
export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const feFrom = (s: ReturnType<typeof createAdminClient>, t: string): any =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s as unknown as any).from(t);

const MAP_ESTADO_ACUSE: Record<string, string> = {
    '1': 'aceptado',
    '2': 'aceptado_parcial',
    '3': 'rechazado'
};

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    if ((user.email || '').trim().toLowerCase() !== ADMIN_EMAIL)
        return NextResponse.json({ error: 'sólo admin' }, { status: 403 });

    let body: { codigo?: string; detalle?: string };
    try {
        body = (await req.json()) as { codigo?: string; detalle?: string };
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const codigo = body.codigo || '1';
    if (!['1', '2', '3'].includes(codigo)) {
        return NextResponse.json(
            { error: 'codigo debe ser 1 (aceptado), 2 (parcial) o 3 (rechazado)' },
            { status: 400 }
        );
    }
    const detalle = (body.detalle || 'Documento recibido').slice(0, 160);

    const admin = createAdminClient();
    const { data: factura, error: facturaErr } = await feFrom(admin, 'fe_facturas_recibidas')
        .select(
            'id, branch_id, clave, fecha_emision, emisor_cedula, emisor_nombre, total_impuesto, total_comprobante, mensaje_receptor_id'
        )
        .eq('id', id)
        .single();
    if (facturaErr || !factura) {
        return NextResponse.json(
            { error: 'factura recibida no encontrada' },
            { status: 404 }
        );
    }
    if (factura.mensaje_receptor_id) {
        return NextResponse.json(
            { error: 'esta factura ya tiene un mensaje receptor emitido' },
            { status: 409 }
        );
    }

    // Build EmitInvoiceRequest for a MensajeReceptor (10). We piggyback
    // on the orchestrator: receptor = supplier (emisor of the original),
    // referencia = { clave, fecha, codigo, razon }, lineas = empty (the
    // mensaje-receptor-10 template doesn't render DetalleServicio).
    const supplier = String(factura.emisor_cedula);
    const supplierName = String(factura.emisor_nombre || '');
    const receptor: EmisorReceptor = {
        nombre: supplierName,
        tipo_identificacion: (supplier.length <= 9 ? '01' : '02') as TipoCedula,
        numero_identificacion: supplier
    };

    // Mensaje Receptor needs at least one line for the tax calculator —
    // we synthesize a single zero-qty line that carries the totals.
    const lineas: EmitInvoiceRequest['lineas'] = [
        {
            codigo_cabys: '0000000000000',
            detalle: `Acuse de documento ${factura.clave}`,
            cantidad: 1,
            precio_unitario: Number(factura.total_comprobante) - Number(factura.total_impuesto),
            unidad_medida: 'Unid',
            impuesto: { codigo_tarifa: '08', tarifa: 13 }
        }
    ];

    const request: EmitInvoiceRequest = {
        branch_id: factura.branch_id || DEFAULT_BRANCH_ID,
        tipo_documento: '10',
        receptor,
        condicion_venta: '01',
        medio_pago: ['01'],
        lineas,
        referencia: {
            tipo_doc: '01',
            numero: factura.clave,
            fecha_emision: factura.fecha_emision,
            codigo,
            razon: detalle
        }
    };

    const result = await emitirDocumento(request);

    if (result.success && result.documento_id) {
        await feFrom(admin, 'fe_facturas_recibidas')
            .update({
                mensaje_receptor_id: result.documento_id,
                estado_acuse: MAP_ESTADO_ACUSE[codigo] || 'aceptado'
            })
            .eq('id', id);
    }

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
