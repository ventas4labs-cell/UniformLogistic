// ─── GET /api/admin/facturacion/pdf/[id] ──────────────────────────────
// Streams the "representación gráfica" PDF for a fe_documento.
// Admin-gated. Materializes line items from fe_lineas joined to the
// header in fe_documentos. Buffer is built in-memory (jspdf has no
// streaming API) and returned as application/pdf.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabase-admin';
import {
    buildInvoicePdf,
    type InvoicePdfDocumento,
    type InvoicePdfLine
} from '@/lib/facturacion/pdf/invoice-pdf';

const ADMIN_EMAIL = 'ulogisticcr@gmail.com';
export const maxDuration = 30;
export const runtime = 'nodejs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const feFrom = (s: ReturnType<typeof createAdminClient>, t: string): any =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s as unknown as any).from(t);

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Auth
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    if ((user.email || '').trim().toLowerCase() !== ADMIN_EMAIL)
        return NextResponse.json({ error: 'sólo admin' }, { status: 403 });

    const admin = createAdminClient();

    const { data: doc, error } = await feFrom(admin, 'fe_documentos')
        .select(
            'id, clave, consecutivo, tipo_documento, fecha_emision, emisor_nombre, emisor_cedula, receptor_nombre, receptor_cedula, condicion_venta, medio_pago, total_venta, total_descuentos, total_impuesto, total_comprobante, estado_hacienda, mensaje_hacienda'
        )
        .eq('id', id)
        .single();
    if (error || !doc) {
        return NextResponse.json({ error: 'documento no encontrado' }, { status: 404 });
    }

    const { data: rows } = await feFrom(admin, 'fe_lineas')
        .select('*')
        .eq('documento_id', id)
        .order('numero_linea');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineas: InvoicePdfLine[] = ((rows || []) as any[]).map((r) => ({
        numero_linea: Number(r.numero_linea),
        detalle: String(r.detalle ?? ''),
        cantidad: Number(r.cantidad),
        unidad_medida: String(r.unidad_medida ?? 'Unid'),
        precio_unitario: Number(r.precio_unitario),
        monto_descuento: r.monto_descuento ? Number(r.monto_descuento) : undefined,
        subtotal: Number(r.subtotal),
        monto_impuesto: r.monto_impuesto ? Number(r.monto_impuesto) : undefined,
        monto_total_linea: Number(r.monto_total_linea)
    }));

    const payload: InvoicePdfDocumento = {
        clave: doc.clave,
        consecutivo: doc.consecutivo,
        tipo_documento: doc.tipo_documento,
        fecha_emision: doc.fecha_emision,
        emisor_nombre: doc.emisor_nombre,
        emisor_cedula: doc.emisor_cedula,
        receptor_nombre: doc.receptor_nombre,
        receptor_cedula: doc.receptor_cedula,
        condicion_venta: doc.condicion_venta,
        medio_pago: Array.isArray(doc.medio_pago) ? doc.medio_pago : undefined,
        total_venta: Number(doc.total_venta ?? 0),
        total_descuentos: Number(doc.total_descuentos ?? 0),
        total_impuesto: Number(doc.total_impuesto ?? 0),
        total_comprobante: Number(doc.total_comprobante ?? 0),
        estado_hacienda: doc.estado_hacienda,
        mensaje_hacienda: doc.mensaje_hacienda,
        lineas
    };

    const buffer = buildInvoicePdf(payload);
    const filename = `${doc.consecutivo}.pdf`;

    return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${filename}"`,
            'Cache-Control': 'private, no-store'
        }
    });
}
