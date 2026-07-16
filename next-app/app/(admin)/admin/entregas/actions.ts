'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { sendDeliveryScheduledEmail } from '@/lib/email/notifications';

const todayIso = () => new Date().toISOString().slice(0, 10);

async function requireUser() {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    return { supabase, user };
}

function revalidate() {
    revalidatePath('/admin/entregas');
    revalidatePath('/admin/orders');
    revalidatePath('/home');
}

/**
 * Set (or change) an order's planned delivery date — the delivery plan.
 * Planning only: does NOT email the customer. Pass a YYYY-MM-DD string.
 */
export async function scheduleDeliveryAction(
    orderUuid: string,
    dateIso: string
): Promise<{ error?: string }> {
    const { supabase, user } = await requireUser();
    if (!user) return { error: 'No autenticado.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return { error: 'Fecha inválida.' };
    const { error } = await supabase.from('order_deliveries').upsert(
        {
            order_id: orderUuid,
            scheduled_date: dateIso,
            scheduled_by: user.id,
            scheduled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        },
        { onConflict: 'order_id' }
    );
    if (error) return { error: error.message };
    revalidate();
    return {};
}

/**
 * Courier picks an order to go deliver TODAY — schedules it for today
 * and notifies the customer their order is out for delivery.
 */
export async function notifyDeliveryTodayAction(
    orderUuid: string
): Promise<{ error?: string }> {
    const { supabase, user } = await requireUser();
    if (!user) return { error: 'No autenticado.' };
    const now = new Date().toISOString();
    const { error } = await supabase.from('order_deliveries').upsert(
        {
            order_id: orderUuid,
            scheduled_date: todayIso(),
            scheduled_by: user.id,
            scheduled_at: now,
            notified_at: now,
            updated_at: now
        },
        { onConflict: 'order_id' }
    );
    if (error) return { error: error.message };
    // Best-effort customer notification — never blocks the action.
    await sendDeliveryScheduledEmail(supabase, orderUuid, todayIso());
    revalidate();
    return {};
}

/** Remove an order from the plan (clear its scheduled date). */
export async function clearScheduleAction(
    orderUuid: string
): Promise<{ error?: string }> {
    const { supabase, user } = await requireUser();
    if (!user) return { error: 'No autenticado.' };
    const { error } = await supabase
        .from('order_deliveries')
        .update({
            scheduled_date: null,
            scheduled_at: null,
            notified_at: null,
            updated_at: new Date().toISOString()
        })
        .eq('order_id', orderUuid);
    if (error) return { error: error.message };
    revalidate();
    return {};
}

/**
 * (Re)generate the driver's shareable link token. Invalidates the old
 * one. Returns the new token so the module can show the /d/<token> URL.
 */
export async function regenerateDriverLinkAction(): Promise<{
    error?: string;
    token?: string;
}> {
    const { supabase, user } = await requireUser();
    if (!user) return { error: 'No autenticado.' };
    const token = randomBytes(24).toString('base64url');
    const { error } = await supabase.from('delivery_driver_link').upsert(
        { id: 'default', token, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
    );
    if (error) return { error: error.message };
    revalidatePath('/admin/entregas');
    return { token };
}

/** Mark (or unmark) an order as delivered. */
export async function markDeliveredAction(
    orderUuid: string,
    delivered: boolean
): Promise<{ error?: string }> {
    const { supabase, user } = await requireUser();
    if (!user) return { error: 'No autenticado.' };
    const { error } = await supabase.from('order_deliveries').upsert(
        {
            order_id: orderUuid,
            delivered_at: delivered ? new Date().toISOString() : null,
            delivered_by: delivered ? user.id : null,
            updated_at: new Date().toISOString()
        },
        { onConflict: 'order_id' }
    );
    if (error) return { error: error.message };
    revalidate();
    return {};
}
