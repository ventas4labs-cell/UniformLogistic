'use server';

import { revalidatePath } from 'next/cache';
import { emitirDocumento } from '@/lib/facturacion/services/invoice-service';
import { DEFAULT_BRANCH_ID } from '@/lib/services/feConfig';
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
    revalidatePath('/admin/orders');
    revalidatePath('/admin/facturacion');
    return result;
}
