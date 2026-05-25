'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createDispatch, DispatchLineInput } from '@/lib/services/dispatches';
import { markStageComplete } from '@/lib/services/stage-completions';

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
    }

    revalidatePath('/admin/empaque');
    revalidatePath('/admin/orders');
}
