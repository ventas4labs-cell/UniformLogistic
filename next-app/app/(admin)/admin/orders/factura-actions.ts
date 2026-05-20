'use server';

import { revalidatePath } from 'next/cache';
import { emitirDocumento } from '@/lib/facturacion/services/invoice-service';
import { DEFAULT_BRANCH_ID } from '@/lib/services/feConfig';
import { linkFeDocumentoToInvoice } from '@/lib/services/invoices';
import { createAdminClient } from '@/lib/supabase-admin';
import type { EmitInvoiceRequest, TipoDocumento, TipoCedula, CodigoTarifa } from '@/lib/facturacion/types';

export interface FacturaLineInput {
    codigo_cabys: string;
    detalle: string;
    cantidad: number;
    precio_unitario: number;
    unidad_medida?: string;
    codigo_tarifa?: CodigoTarifa;
    tarifa?: number;
}

export interface FacturaReceptorInput {
    nombre: string;
    tipo_identificacion: TipoCedula;
    numero_identificacion: string;
    correo?: string;
    telefono?: string;
}

export interface EmitirFacturaInput {
    order_id?: string;
    tipo_documento: TipoDocumento; // '01' Factura, '04' Tiquete
    receptor?: FacturaReceptorInput;
    lineas: FacturaLineInput[];
}

export interface EmitirFacturaResult {
    success: boolean;
    clave?: string;
    consecutivo?: string;
    documento_id?: string;
    estado_hacienda?: string;
    error?: string;
}

export async function emitirFacturaAction(input: EmitirFacturaInput): Promise<EmitirFacturaResult> {
    const request: EmitInvoiceRequest = {
        branch_id: DEFAULT_BRANCH_ID,
        order_id: input.order_id,
        tipo_documento: input.tipo_documento,
        receptor: input.receptor
            ? {
                  nombre: input.receptor.nombre,
                  tipo_identificacion: input.receptor.tipo_identificacion,
                  numero_identificacion: input.receptor.numero_identificacion.replace(/\D/g, ''),
                  correo: input.receptor.correo || undefined,
                  telefono: input.receptor.telefono || undefined
              }
            : undefined,
        condicion_venta: '01',
        medio_pago: ['01'],
        lineas: input.lineas.map((l) => ({
            codigo_cabys: l.codigo_cabys,
            detalle: l.detalle,
            cantidad: l.cantidad,
            precio_unitario: l.precio_unitario,
            unidad_medida: l.unidad_medida || 'Unid',
            impuesto:
                l.codigo_tarifa && l.tarifa !== undefined
                    ? { codigo_tarifa: l.codigo_tarifa, tarifa: l.tarifa }
                    : { codigo_tarifa: '08', tarifa: 13 }
        }))
    };

    const result = await emitirDocumento(request);

    // After a successful emission, link the fe_documento to an invoices
    // row so /admin/cuentas and the customer's /cuentas reflect the
    // receivable. Failure here doesn't roll back the emission — the
    // factura is already legally bound by Hacienda; we just log and
    // continue so the admin can fix linkage manually.
    if (result.success && result.documento_id && input.order_id) {
        try {
            const supabase = createAdminClient();
            // Compute amounts from the line totals we sent. Hacienda stores
            // them too, but using the input here means we don't need a
            // round-trip on the fe_documentos row.
            const subtotal = input.lineas.reduce(
                (s, l) => s + l.cantidad * l.precio_unitario,
                0
            );
            const ivaAmount = input.lineas.reduce((s, l) => {
                const t = (l.tarifa ?? 0) / 100;
                return s + l.cantidad * l.precio_unitario * t;
            }, 0);
            const total = subtotal + ivaAmount;

            // Resolve the order's company_id.
            const { data: order } = await supabase
                .from('orders')
                .select('company_id')
                .eq('id', input.order_id)
                .maybeSingle();
            if (order?.company_id) {
                await linkFeDocumentoToInvoice(supabase, {
                    feDocumentoId: result.documento_id,
                    orderId: input.order_id,
                    companyId: order.company_id,
                    total,
                    ivaAmount,
                    subtotal,
                    tipoDocumento: input.tipo_documento,
                    consecutivo: result.consecutivo || ''
                });
            }
        } catch (linkErr) {
            console.error(
                '[FE] Linking fe_documento → invoices failed (emission still valid):',
                linkErr
            );
        }
    }

    revalidatePath('/admin/orders');
    revalidatePath('/admin/facturacion');
    revalidatePath('/admin/cuentas');
    return result;
}
