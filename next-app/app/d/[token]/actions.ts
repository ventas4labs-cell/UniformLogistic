'use server';

// Server actions for the public, tokenized driver delivery link. Writes
// run with the service-role client (the driver has no login), gated on
// the shared driver token — the same secret that lets them read the plan.

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/utils/supabase/server';
import { isValidDriverToken } from '@/lib/services/deliveries';
import { sendDeliveryDeliveredEmail } from '@/lib/email/notifications';

/**
 * The driver marks an order delivered from their phone. Validates the
 * shared driver token, then stamps delivered_at (leaving delivered_by
 * null — there's no user behind a token link). Only flips rows that
 * aren't already delivered, so a double-tap is a no-op.
 */
export async function markOrderDeliveredByDriverAction(
    token: string,
    orderId: string
): Promise<{ error?: string }> {
    const service = createServiceClient();

    const valid = await isValidDriverToken(service, token);
    if (!valid) return { error: 'Link inválido.' };
    if (!orderId) return { error: 'Pedido inválido.' };

    const now = new Date().toISOString();
    const { data: flipped, error } = await service
        .from('order_deliveries')
        .update({ delivered_at: now, updated_at: now })
        .eq('order_id', orderId)
        .is('delivered_at', null)
        .select('order_id');
    if (error) return { error: error.message };

    // Only notify when this call actually flipped the row (a double-tap
    // matches zero rows), so the customer never gets a duplicate email.
    // Best-effort — a mail hiccup must not fail the driver's delivery.
    if (flipped && flipped.length > 0) {
        await sendDeliveryDeliveredEmail(service, orderId);
    }

    // Keep the driver plan and the admin views in sync.
    revalidatePath(`/d/${token}`);
    revalidatePath('/admin/entregas');
    revalidatePath('/admin/orders');
    revalidatePath('/home');
    return {};
}
