'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createDispatch, DispatchLineInput } from '@/lib/services/dispatches';
import type { StockEntryLineInput } from '@/lib/services/stock-entries';
import { markStageComplete } from '@/lib/services/stage-completions';
import { sendOrderCompletedEmail } from '@/lib/email/notifications';

/**
 * Record a partial (or full) dispatch from Empaque. After inserting,
 * checks if every order_item is fully shipped — if so, also flips
 * order_stage_completions for stage='empaque' so the board's
 * "Pendientes/Completados" tabs and the Pedidos strip update without
 * a second click.
 *
 * Caller passes the ordered quantities so we don't need to round-trip
 * them — they're already on the client when the modal opens.
 */
export async function createDispatchAction(
    orderUuid: string,
    lines: DispatchLineInput[],
    notes: string | undefined,
    orderedTotals: { orderItemId: string; ordered: number }[]
): Promise<void> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    await createDispatch(supabase, orderUuid, lines, notes, user.id);

    // Re-read totals after insert (cheap, single query) and decide
    // whether to auto-complete the stage.
    const { data: rows, error } = await supabase
        .from('order_dispatch_items')
        .select('order_item_id, quantity, dispatch:order_dispatches!inner(order_id)')
        .eq('dispatch.order_id', orderUuid);
    if (error) throw error;

    const dispatched = new Map<string, number>();
    for (const r of (rows || []) as { order_item_id: string; quantity: number }[]) {
        dispatched.set(r.order_item_id, (dispatched.get(r.order_item_id) || 0) + r.quantity);
    }
    const fullyShipped = orderedTotals.every(
        (t) => (dispatched.get(t.orderItemId) || 0) >= t.ordered
    );
    if (fullyShipped && orderedTotals.length > 0) {
        await markStageComplete(supabase, orderUuid, 'empaque', user.id);
        // The order just became fully delivered — notify the customer.
        // Best-effort; never throws.
        await sendOrderCompletedEmail(supabase, orderUuid);
    }

    revalidatePath('/admin/empaque');
    revalidatePath('/admin/orders');
}

/**
 * Push (part of) a finished order into the company's stock. Delegates to
 * the add_order_to_stock RPC, which records the per-line entry and
 * increments company_stock in one transaction, capping each line at
 * ordered − already-added so repeated partial adds never overshoot.
 */
export async function addOrderToStockAction(
    orderUuid: string,
    lines: StockEntryLineInput[],
    notes?: string
): Promise<{ error?: string; added?: number }> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    const validLines = lines.filter((l) => Number.isFinite(l.quantity) && l.quantity > 0);
    if (validLines.length === 0) return { error: 'Ingresá al menos una cantidad.' };

    const { data, error } = await supabase.rpc('add_order_to_stock', {
        p_order_id: orderUuid,
        p_lines: validLines.map((l) => ({
            order_item_id: l.orderItemId,
            quantity: Math.round(l.quantity)
        })),
        p_notes: notes || null
    });
    if (error) return { error: error.message };

    revalidatePath('/admin/empaque');
    revalidatePath('/admin/orders');
    revalidatePath('/admin/stock');
    return { added: (data as { added?: number } | null)?.added };
}
