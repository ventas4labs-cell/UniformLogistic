import type { SupabaseClient } from '@supabase/supabase-js';

export interface DispatchLineInput {
    orderItemId: string;
    quantity: number;
}

export interface Dispatch {
    id: string;
    orderId: string;
    dispatchedAt: string;
    dispatchedBy: string | null;
    notes: string | null;
    lines: { orderItemId: string; quantity: number }[];
}

interface DispatchRow {
    id: string;
    order_id: string;
    dispatched_at: string;
    dispatched_by: string | null;
    notes: string | null;
    items: { order_item_id: string; quantity: number }[] | null;
}

const SELECT =
    'id, order_id, dispatched_at, dispatched_by, notes, items:order_dispatch_items ( order_item_id, quantity )';

const mapRow = (r: DispatchRow): Dispatch => ({
    id: r.id,
    orderId: r.order_id,
    dispatchedAt: r.dispatched_at,
    dispatchedBy: r.dispatched_by,
    notes: r.notes,
    lines: (r.items || []).map((i) => ({
        orderItemId: i.order_item_id,
        quantity: i.quantity
    }))
});

export async function fetchDispatchesForOrders(
    supabase: SupabaseClient,
    orderIds: string[]
): Promise<Dispatch[]> {
    if (orderIds.length === 0) return [];
    const { data, error } = await supabase
        .from('order_dispatches')
        .select(SELECT)
        .in('order_id', orderIds)
        .order('dispatched_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as DispatchRow[]).map(mapRow);
}

/**
 * For each order, sum dispatched quantity per order_item_id. Empaque
 * board uses this to compute remaining = ordered - dispatched per line.
 */
export type DispatchTotalsByOrder = Map<string, Map<string, number>>;

export function indexDispatchTotals(dispatches: Dispatch[]): DispatchTotalsByOrder {
    const out: DispatchTotalsByOrder = new Map();
    for (const d of dispatches) {
        let perOrder = out.get(d.orderId);
        if (!perOrder) {
            perOrder = new Map();
            out.set(d.orderId, perOrder);
        }
        for (const l of d.lines) {
            perOrder.set(l.orderItemId, (perOrder.get(l.orderItemId) || 0) + l.quantity);
        }
    }
    return out;
}

export async function fetchDispatchTotalsForOrders(
    supabase: SupabaseClient,
    orderIds: string[]
): Promise<DispatchTotalsByOrder> {
    const dispatches = await fetchDispatchesForOrders(supabase, orderIds);
    return indexDispatchTotals(dispatches);
}

export async function createDispatch(
    supabase: SupabaseClient,
    orderId: string,
    lines: DispatchLineInput[],
    notes: string | undefined,
    userId: string | null
): Promise<Dispatch> {
    if (lines.length === 0) throw new Error('Dispatch must include at least one line');
    for (const l of lines) {
        if (!Number.isFinite(l.quantity) || l.quantity <= 0) {
            throw new Error(`Cantidad inválida para ${l.orderItemId}`);
        }
    }
    const { data: header, error: hErr } = await supabase
        .from('order_dispatches')
        .insert({
            order_id: orderId,
            dispatched_by: userId,
            notes: notes || null
        })
        .select('id, order_id, dispatched_at, dispatched_by, notes')
        .single();
    if (hErr) throw hErr;

    const { error: lErr } = await supabase.from('order_dispatch_items').insert(
        lines.map((l) => ({
            dispatch_id: header.id,
            order_item_id: l.orderItemId,
            quantity: Math.round(l.quantity)
        }))
    );
    if (lErr) {
        // Roll back the header — the FK cascade would also clean up if
        // the row existed, but we beat it to the punch on the error path.
        await supabase.from('order_dispatches').delete().eq('id', header.id);
        throw lErr;
    }

    return {
        id: header.id,
        orderId: header.order_id,
        dispatchedAt: header.dispatched_at,
        dispatchedBy: header.dispatched_by,
        notes: header.notes,
        lines: lines.map((l) => ({
            orderItemId: l.orderItemId,
            quantity: Math.round(l.quantity)
        }))
    };
}
