'use server';

import { revalidatePath } from 'next/cache';
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

export interface EmitirNotaInput {
    original_documento_id: string;
    tipo: '02' | '03';
    /** Hacienda's codigo_referencia: '01'=Anula, '02'=Corrige texto, etc. */
    codigo_referencia: string;
    razon: string;
    /** Optional override of the lineas to credit/debit (subset of the original). */
    lineas?: EmitInvoiceRequest['lineas'];
}

export interface EmitirNotaResult {
    success: boolean;
    clave?: string;
    consecutivo?: string;
    documento_id?: string;
    estado_hacienda?: string;
    error?: string;
}

// The fe_* tables don't have generated TS types yet — typed escape hatch.
const feFrom = (
    supabase: ReturnType<typeof createAdminClient>,
    table: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => (supabase as unknown as any).from(table);

export async function emitirNotaAction(
    input: EmitirNotaInput
): Promise<EmitirNotaResult> {
    if (input.tipo !== '02' && input.tipo !== '03') {
        return { success: false, error: 'tipo debe ser 02 (Nota Débito) o 03 (Nota Crédito)' };
    }
    if (!input.codigo_referencia || !input.razon) {
        return { success: false, error: 'codigo_referencia y razon son requeridos' };
    }

    const admin = createAdminClient();
    const { data: original, error: origErr } = await feFrom(admin, 'fe_documentos')
        .select(
            'id, branch_id, order_id, clave, consecutivo, tipo_documento, fecha_emision, receptor_cedula, receptor_nombre, condicion_venta, medio_pago'
        )
        .eq('id', input.original_documento_id)
        .single();
    if (origErr || !original) {
        return { success: false, error: 'documento original no encontrado' };
    }

    let lineas: EmitInvoiceRequest['lineas'] = input.lineas ?? [];
    if (lineas.length === 0) {
        const { data: rows } = await feFrom(admin, 'fe_lineas')
            .select('*')
            .eq('documento_id', input.original_documento_id)
            .order('numero_linea');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lineas = ((rows || []) as any[]).map((r) => ({
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
                ? { codigo_tarifa: r.codigo_tarifa, tarifa: Number(r.tarifa ?? 13) }
                : { codigo_tarifa: '08', tarifa: 13 }
        }));
        if (lineas.length === 0) {
            return {
                success: false,
                error: 'no se encontraron líneas para copiar del documento original'
            };
        }
    }

    let receptor: EmisorReceptor | undefined;
    if (original.receptor_cedula) {
        const cedula = String(original.receptor_cedula);
        receptor = {
            nombre: String(original.receptor_nombre || ''),
            tipo_identificacion: (cedula.length <= 9 ? '01' : '02') as TipoCedula,
            numero_identificacion: cedula
        };
    }

    const request: EmitInvoiceRequest = {
        branch_id: original.branch_id || DEFAULT_BRANCH_ID,
        order_id: original.order_id || undefined,
        tipo_documento: input.tipo,
        receptor,
        condicion_venta: original.condicion_venta || '01',
        medio_pago: Array.isArray(original.medio_pago) ? original.medio_pago : ['01'],
        lineas,
        referencia: {
            tipo_doc: original.tipo_documento as TipoDocumento,
            numero: original.clave,
            fecha_emision: original.fecha_emision,
            codigo: input.codigo_referencia,
            razon: input.razon.slice(0, 180)
        }
    };

    const result = await emitirDocumento(request);

    if (result.success && result.documento_id && request.order_id) {
        try {
            const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0);
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
                    tipoDocumento: input.tipo,
                    consecutivo: result.consecutivo || ''
                });
            }
        } catch (linkErr) {
            console.error('[FE nota action] Linking failed:', linkErr);
        }
    }

    revalidatePath('/admin/facturacion');
    revalidatePath('/admin/orders');
    revalidatePath('/admin/cuentas');
    return result;
}
