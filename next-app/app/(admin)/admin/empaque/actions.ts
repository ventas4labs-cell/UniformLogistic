'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createDispatch, DispatchLineInput } from '@/lib/services/dispatches';
import type { StockEntryLineInput } from '@/lib/services/stock-entries';
import { markStageComplete } from '@/lib/services/stage-completions';
import { isAdminEmail } from '@/lib/admin-acting-company';

// ─── Unified dispatch: route each line to delivery OR customer stock ──

export type DispatchDestination = 'delivery' | 'stock';
export interface DispatchDestinationLine {
    orderItemId: string;
    quantity: number;
    destination: DispatchDestination;
}

// Being inside the (admin) route group is NOT a gate: a server action runs
// and commits before the render pass that would hit the layout redirect,
// and it's addressed by action id, so it can be POSTed from any page the
// caller can load. Every mutation re-checks, like the other admin actions.
async function requireAdmin() {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado.' as const, supabase: null, userId: null };
    if (!isAdminEmail(user.email))
        return { error: 'No autorizado.' as const, supabase: null, userId: null };
    return { error: null, supabase, userId: user.id };
}

/**
 * Single "Despachar" entry point. Each line's pieces go to exactly ONE
 * destination — entrega (order_dispatches) or the customer's stock
 * (add_order_to_stock → company_stock).
 *
 * Ordered quantities are read from the DB here, never taken from the
 * caller: the board freezes its copy at mount, so a line edited in another
 * tab would otherwise let the operator dispatch against a stale figure.
 * The combined cap (ordered − delivered − stocked) is additionally enforced
 * by a trigger on both ledger tables, so no writer can bypass it.
 */
export async function dispatchOrderAction(
    orderUuid: string,
    lines: DispatchDestinationLine[],
    notes?: string
): Promise<{ error?: string; dispatched?: number; stocked?: number }> {
    const { error: adminErr, supabase, userId } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    const db = supabase!;

    // Ordered quantities + product linkage, straight from the DB. Scoping
    // by order_id also rejects an order_item_id from a different order.
    const { data: itemRows, error: itemsErr } = await db
        .from('order_items')
        .select('id, quantity, product_id')
        .eq('order_id', orderUuid);
    if (itemsErr) return { error: itemsErr.message };
    const items = (itemRows || []) as {
        id: string;
        quantity: number;
        product_id: string | null;
    }[];
    if (items.length === 0) return { error: 'El pedido no tiene líneas.' };
    const orderedById = new Map(items.map((i) => [i.id, i.quantity]));
    const productById = new Map(items.map((i) => [i.id, i.product_id]));

    // Current out-totals per line, from BOTH ledgers.
    const [dispRes, stockRes] = await Promise.all([
        db
            .from('order_dispatch_items')
            .select('order_item_id, quantity, dispatch:order_dispatches!inner(order_id)')
            .eq('dispatch.order_id', orderUuid),
        db
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

    // Clamp each line to the COMBINED remaining, then split by destination.
    const deliveryLines: DispatchLineInput[] = [];
    const stockLines: StockEntryLineInput[] = [];
    for (const l of lines) {
        const ordered = orderedById.get(l.orderItemId);
        if (ordered === undefined) continue; // not a line of this order
        const out = (dispatched.get(l.orderItemId) || 0) + (stocked.get(l.orderItemId) || 0);
        const remaining = Math.max(0, ordered - out);
        const qty = Math.min(Math.max(0, Math.round(l.quantity)), remaining);
        if (qty <= 0) continue;
        if (l.destination === 'stock') {
            // Corte "extra" lines carry no product, so they can't become
            // stock. Reject up front instead of letting the RPC raise after
            // the delivery leg has already committed.
            if (!productById.get(l.orderItemId)) {
                return {
                    error: 'Hay piezas extra sin producto vinculado; esas solo pueden ir a entrega, no a stock.'
                };
            }
            stockLines.push({ orderItemId: l.orderItemId, quantity: qty });
        } else deliveryLines.push({ orderItemId: l.orderItemId, quantity: qty });
    }
    if (deliveryLines.length === 0 && stockLines.length === 0) {
        return { error: 'No hay piezas para despachar (revisá las cantidades restantes).' };
    }

    // Stock first: it's the atomic, self-validating leg. If it rejects, the
    // delivery rows haven't been written yet, so nothing is half-applied.
    if (stockLines.length > 0) {
        const { error } = await db.rpc('add_order_to_stock', {
            p_order_id: orderUuid,
            p_lines: stockLines.map((l) => ({
                order_item_id: l.orderItemId,
                quantity: l.quantity
            })),
            p_notes: notes?.trim() || null
        });
        if (error) return { error: error.message };
    }
    if (deliveryLines.length > 0) {
        try {
            await createDispatch(db, orderUuid, deliveryLines, notes?.trim() || undefined, userId!);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'No se pudo registrar la entrega.';
            return {
                error:
                    stockLines.length > 0
                        ? `Las piezas a stock se guardaron, pero la entrega falló: ${msg}. Volvé a despachar solo las de entrega.`
                        : msg
            };
        }
    }

    // Combined coverage across EVERY line of the order completes empaque.
    for (const l of deliveryLines)
        dispatched.set(l.orderItemId, (dispatched.get(l.orderItemId) || 0) + l.quantity);
    for (const l of stockLines)
        stocked.set(l.orderItemId, (stocked.get(l.orderItemId) || 0) + l.quantity);
    const fullyCovered = items.every(
        (i) => (dispatched.get(i.id) || 0) + (stocked.get(i.id) || 0) >= i.quantity
    );
    if (fullyCovered) await markStageComplete(db, orderUuid, 'empaque', userId!);

    revalidatePath('/admin/empaque');
    revalidatePath('/admin/orders');
    revalidatePath('/admin/stock');
    revalidatePath('/admin/entregas');
    revalidatePath('/home');
    return {
        dispatched: deliveryLines.reduce((s, l) => s + l.quantity, 0),
        stocked: stockLines.reduce((s, l) => s + l.quantity, 0)
    };
}
