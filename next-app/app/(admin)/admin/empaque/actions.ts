'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createDispatch, DispatchLineInput } from '@/lib/services/dispatches';
import type { StockEntryLineInput } from '@/lib/services/stock-entries';
import { markStageComplete } from '@/lib/services/stage-completions';
import { sendOrderCompletedEmail } from '@/lib/email/notifications';

// ─── Unified dispatch: route each line to delivery OR customer stock ──

export type DispatchDestination = 'delivery' | 'stock';
export interface DispatchDestinationLine {
    orderItemId: string;
    quantity: number;
    destination: DispatchDestination;
}

/**
 * Single "Despachar" entry point. Each line's pieces go to exactly ONE
 * destination — entrega (order_dispatches) or the customer's stock
 * (add_order_to_stock → company_stock). Every line is capped server-side
 * at ordered − (alreadyDispatched + alreadyStocked), so a piece can never
 * be counted in both channels (the historical double-count bug). Full
 * coverage across both channels completes empaque. No "entregado" email
 * fires here — real delivery emails from the driver/entregas flow.
 */
export async function dispatchOrderAction(
    orderUuid: string,
    lines: DispatchDestinationLine[],
    orderedTotals: { orderItemId: string; ordered: number }[],
    notes?: string
): Promise<{ error?: string; dispatched?: number; stocked?: number }> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };

    // Current out-totals per line, from BOTH ledgers.
    const [dispRes, stockRes] = await Promise.all([
        supabase
            .from('order_dispatch_items')
            .select('order_item_id, quantity, dispatch:order_dispatches!inner(order_id)')
            .eq('dispatch.order_id', orderUuid),
        supabase
            .from('order_stock_entry_items')
            .select('order_item_id, quantity, entry:order_stock_entries!inner(order_id)')
            .eq('entry.order_id', orderUuid)
    ]);
    if (dispRes.error) return { error: dispRes.error.message };
    if (stockRes.error) return { error: stockRes.error.message };

    const sum = (
        rows: { order_item_id: string; quantity: number }[] | null
    ): Map<string, number> => {
        const m = new Map<string, number>();
        for (const r of rows || [])
            m.set(r.order_item_id, (m.get(r.order_item_id) || 0) + r.quantity);
        return m;
    };
    const dispatched = sum(dispRes.data as never);
    const stocked = sum(stockRes.data as never);
    const orderedById = new Map(orderedTotals.map((t) => [t.orderItemId, t.ordered]));

    // Clamp each line to the COMBINED remaining, then split by destination.
    const deliveryLines: DispatchLineInput[] = [];
    const stockLines: StockEntryLineInput[] = [];
    for (const l of lines) {
        const ordered = orderedById.get(l.orderItemId) ?? 0;
        const out = (dispatched.get(l.orderItemId) || 0) + (stocked.get(l.orderItemId) || 0);
        const remaining = Math.max(0, ordered - out);
        const qty = Math.min(Math.max(0, Math.round(l.quantity)), remaining);
        if (qty <= 0) continue;
        if (l.destination === 'stock')
            stockLines.push({ orderItemId: l.orderItemId, quantity: qty });
        else deliveryLines.push({ orderItemId: l.orderItemId, quantity: qty });
    }
    if (deliveryLines.length === 0 && stockLines.length === 0) {
        return { error: 'No hay piezas para despachar (revisá las cantidades restantes).' };
    }

    if (deliveryLines.length > 0) {
        await createDispatch(supabase, orderUuid, deliveryLines, notes?.trim() || undefined, user.id);
    }
    if (stockLines.length > 0) {
        const { error } = await supabase.rpc('add_order_to_stock', {
            p_order_id: orderUuid,
            p_lines: stockLines.map((l) => ({
                order_item_id: l.orderItemId,
                quantity: l.quantity
            })),
            p_notes: notes?.trim() || null
        });
        if (error) return { error: error.message };
    }

    // Combined coverage completes empaque (fixes the add-to-stock asymmetry).
    for (const l of deliveryLines)
        dispatched.set(l.orderItemId, (dispatched.get(l.orderItemId) || 0) + l.quantity);
    for (const l of stockLines)
        stocked.set(l.orderItemId, (stocked.get(l.orderItemId) || 0) + l.quantity);
    const fullyCovered =
        orderedTotals.length > 0 &&
        orderedTotals.every(
            (t) =>
                (dispatched.get(t.orderItemId) || 0) + (stocked.get(t.orderItemId) || 0) >=
                t.ordered
        );
    if (fullyCovered) await markStageComplete(supabase, orderUuid, 'empaque', user.id);

    revalidatePath('/admin/empaque');
    revalidatePath('/admin/orders');
    revalidatePath('/admin/stock');
    revalidatePath('/home');
    return {
        dispatched: deliveryLines.reduce((s, l) => s + l.quantity, 0),
        stocked: stockLines.reduce((s, l) => s + l.quantity, 0)
    };
}

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
