'use server';

import { createServiceClient } from '@/utils/supabase/server';
import {
    createFastOrderRequest,
    type FastOrderContact,
    type FastOrderItem
} from '@/lib/services/fast-orders';
import { sendFastOrderEmails } from '@/lib/email/notifications';

export interface FastOrderSubmitResult {
    ok: boolean;
    requestRef?: string;
    error?: string;
}

// Public endpoint: a logged-out visitor submits a fast order. Uses the
// service-role client because the visitor is unauthenticated (RLS on
// order_requests is authenticated-only). Runs server-side only, so the
// key never reaches the browser. Stored with status='pending' so it
// lands in the admin Pedidos → Solicitudes list as a request (not yet a
// real order).
export async function submitFastOrderAction(
    contact: FastOrderContact,
    items: FastOrderItem[]
): Promise<FastOrderSubmitResult> {
    // Validate server-side — never trust the client payload.
    if (!contact.name?.trim()) {
        return { ok: false, error: 'Ingresá tu nombre.' };
    }
    if (!contact.email?.trim() && !contact.phone?.trim()) {
        return {
            ok: false,
            error: 'Dejanos un correo o teléfono para poder contactarte.'
        };
    }
    const clean = (items || [])
        .filter((it) => it.productCode && it.quantity > 0)
        .map((it) => ({
            ...it,
            quantity: Math.max(1, Math.floor(it.quantity)),
            color: (it.color || '').trim(),
            size: (it.size || '').trim()
        }));
    if (clean.length === 0) {
        return { ok: false, error: 'Agregá al menos un producto a tu pedido.' };
    }

    try {
        const supabase = createServiceClient();
        const request = await createFastOrderRequest(
            supabase,
            {
                name: contact.name.trim(),
                email: contact.email.trim(),
                phone: contact.phone.trim(),
                company: contact.company.trim(),
                notes: contact.notes.trim()
            },
            clean
        );
        // Confirm to the customer + notify the admin. Best-effort:
        // sendFastOrderEmails never throws, so a mail hiccup can't fail
        // the already-saved request.
        await sendFastOrderEmails(request);
        return { ok: true, requestRef: request.requestRef };
    } catch (e) {
        return {
            ok: false,
            error:
                e instanceof Error
                    ? e.message
                    : 'No pudimos enviar tu pedido. Intentá de nuevo.'
        };
    }
}
