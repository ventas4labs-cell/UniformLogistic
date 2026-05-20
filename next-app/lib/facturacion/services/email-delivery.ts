// ─── Email delivery for accepted fe_documentos ────────────────────────
// Provider-agnostic façade: dispatches by env var so the project can pick
// Resend / SendGrid / SMTP without changing call sites. When no provider
// is configured the function logs and returns gracefully (no throw) so
// the emit pipeline doesn't fail because email isn't wired yet.
//
// Wired into delivery-service.ts in Phase F4.

import 'server-only';
import { createAdminClient } from '@/lib/supabase-admin';
import {
    buildInvoicePdf,
    type InvoicePdfDocumento,
    type InvoicePdfLine
} from '@/lib/facturacion/pdf/invoice-pdf';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const feFrom = (s: ReturnType<typeof createAdminClient>, t: string): any =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s as unknown as any).from(t);

export interface DeliveryAttachment {
    filename: string;
    contentType: string;
    contentBase64: string;
}

export interface DeliveryEmail {
    to: string;
    subject: string;
    bodyText: string;
    attachments: DeliveryAttachment[];
}

export interface DeliveryResult {
    ok: boolean;
    provider: string;
    skipped?: boolean;
    error?: string;
    messageId?: string;
}

/**
 * Assemble + send the customer-facing email for an accepted document.
 * Caller passes the fe_documento.id; we materialize everything from the
 * DB ourselves so the function can be invoked from any context (emit
 * pipeline, cron sweep, manual re-send).
 */
export async function deliverAcceptedDocumentByEmail(
    documentoId: string
): Promise<DeliveryResult> {
    const admin = createAdminClient();
    const { data: doc, error } = await feFrom(admin, 'fe_documentos')
        .select(
            'id, clave, consecutivo, tipo_documento, fecha_emision, emisor_nombre, emisor_cedula, receptor_nombre, receptor_cedula, condicion_venta, medio_pago, total_venta, total_descuentos, total_impuesto, total_comprobante, estado_hacienda, mensaje_hacienda, xml_firmado, xml_respuesta_hacienda, order_id'
        )
        .eq('id', documentoId)
        .single();
    if (error || !doc) return { ok: false, provider: 'none', error: 'documento no encontrado' };

    // Resolve recipient email — order's company first, fall back to none.
    let to = '';
    if (doc.order_id) {
        const { data: order } = await admin
            .from('orders')
            .select('company:companies(email)')
            .eq('id', doc.order_id)
            .maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const company = Array.isArray((order as any)?.company)
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (order as any).company[0]
            : // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (order as any)?.company;
        to = String(company?.email || '').trim();
    }
    if (!to) {
        return { ok: false, provider: 'none', error: 'sin correo de receptor' };
    }

    // Materialize lines for the PDF.
    const { data: rows } = await feFrom(admin, 'fe_lineas')
        .select('*')
        .eq('documento_id', documentoId)
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
    const pdfBuffer = buildInvoicePdf(payload);

    const attachments: DeliveryAttachment[] = [
        {
            filename: `${doc.consecutivo}.pdf`,
            contentType: 'application/pdf',
            contentBase64: pdfBuffer.toString('base64')
        }
    ];
    if (doc.xml_firmado) {
        attachments.push({
            filename: `${doc.consecutivo}.xml`,
            contentType: 'application/xml',
            contentBase64: Buffer.from(doc.xml_firmado, 'utf-8').toString('base64')
        });
    }
    if (doc.xml_respuesta_hacienda) {
        // Hacienda's respuesta-xml comes back base64-encoded already.
        attachments.push({
            filename: `${doc.consecutivo}-hacienda.xml`,
            contentType: 'application/xml',
            contentBase64: doc.xml_respuesta_hacienda
        });
    }

    const subject = `${tipoLabel(doc.tipo_documento)} ${doc.consecutivo} — Uniform Logistic`;
    const bodyText =
        `${doc.receptor_nombre ? `Estimado/a ${doc.receptor_nombre},\n\n` : ''}` +
        `Adjuntamos su comprobante electrónico:\n\n` +
        `  Tipo: ${tipoLabel(doc.tipo_documento)}\n` +
        `  Consecutivo: ${doc.consecutivo}\n` +
        `  Total: ${new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(Number(doc.total_comprobante ?? 0))}\n` +
        `  Estado Hacienda: ${doc.estado_hacienda}\n\n` +
        `Se incluyen los archivos PDF + XML firmado + respuesta de Hacienda.\n\n` +
        `Uniform Logistic`;

    const email: DeliveryEmail = { to, subject, bodyText, attachments };
    return sendEmail(email);
}

function tipoLabel(t: string): string {
    return (
        {
            '01': 'Factura',
            '02': 'Nota Débito',
            '03': 'Nota Crédito',
            '04': 'Tiquete',
            '08': 'Factura de Compra',
            '10': 'Mensaje Receptor'
        }[t] || 'Documento'
    );
}

/**
 * Pluggable dispatch. Picks the first provider that has its env vars set:
 *   1. Resend (RESEND_API_KEY) — recommended for Vercel deploys
 *   2. SMTP   (SMTP_HOST + SMTP_USER + SMTP_PASS) — Phase F4+ stub
 * Returns { skipped: true } when no provider is wired so the pipeline
 * doesn't fail emissions because email isn't configured yet.
 */
async function sendEmail(email: DeliveryEmail): Promise<DeliveryResult> {
    if (process.env.RESEND_API_KEY) {
        return sendViaResend(email);
    }
    // Future: add SMTP/SendGrid branches here.
    console.warn(
        '[FE delivery] No email provider configured (RESEND_API_KEY missing). Skipping send for',
        email.to
    );
    return { ok: false, provider: 'none', skipped: true };
}

async function sendViaResend(email: DeliveryEmail): Promise<DeliveryResult> {
    const apiKey = process.env.RESEND_API_KEY!;
    const from = process.env.RESEND_FROM_ADDRESS || 'no-reply@uniformlogistic.com';
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from,
                to: email.to,
                subject: email.subject,
                text: email.bodyText,
                attachments: email.attachments.map((a) => ({
                    filename: a.filename,
                    content: a.contentBase64
                }))
            })
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            return { ok: false, provider: 'resend', error: `HTTP ${res.status} ${text}` };
        }
        const data = (await res.json()) as { id?: string };
        return { ok: true, provider: 'resend', messageId: data.id };
    } catch (e) {
        return {
            ok: false,
            provider: 'resend',
            error: e instanceof Error ? e.message : String(e)
        };
    }
}
