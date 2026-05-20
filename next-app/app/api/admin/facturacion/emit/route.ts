// ─── POST /api/admin/facturacion/emit ─────────────────────────────────
// Public REST counterpart to emitirFacturaAction. Accepts the same
// EmitInvoiceRequest shape the orchestrator consumes, runs the full
// pipeline, and links the resulting fe_documento to an invoices row.
//
// Used by CLI scripts, future crons, and any external system that wants
// to trigger an emission. Inside the app the server action stays the
// happy path (no extra network hop).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { emitirDocumento } from '@/lib/facturacion/services/invoice-service';
import { linkFeDocumentoToInvoice } from '@/lib/services/invoices';
import { DEFAULT_BRANCH_ID } from '@/lib/services/feConfig';
import type { EmitInvoiceRequest } from '@/lib/facturacion/types';

const ADMIN_EMAIL = 'ulogisticcr@gmail.com';
export const maxDuration = 60;

interface BodyShape extends Partial<EmitInvoiceRequest> {
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

    let body: BodyShape;
    try {
        body = (await req.json()) as BodyShape;
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    if (!body.tipo_documento) {
        return NextResponse.json({ error: 'tipo_documento requerido' }, { status: 400 });
    }
    if (!body.lineas || body.lineas.length === 0) {
        return NextResponse.json({ error: 'lineas vacías' }, { status: 400 });
    }

    const request: EmitInvoiceRequest = {
        branch_id: body.branch_id || DEFAULT_BRANCH_ID,
        order_id: body.order_id,
        tipo_documento: body.tipo_documento,
        situacion: body.situacion,
        codigo_actividad: body.codigo_actividad,
        receptor: body.receptor,
        condicion_venta: body.condicion_venta || '01',
        medio_pago: body.medio_pago || ['01'],
        lineas: body.lineas,
        referencia: body.referencia
    };

    const result = await emitirDocumento(request);

    if (result.success && result.documento_id && request.order_id) {
        try {
            const admin = createAdminClient();
            const subtotal = request.lineas.reduce(
                (s, l) => s + l.cantidad * l.precio_unitario,
                0
            );
            const ivaAmount = request.lineas.reduce((s, l) => {
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
                    tipoDocumento: request.tipo_documento,
                    consecutivo: result.consecutivo || '',
                    paymentTermDays: body.payment_term_days
                });
            }
        } catch (linkErr) {
            console.error('[FE emit route] Linking failed:', linkErr);
        }
    }

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
