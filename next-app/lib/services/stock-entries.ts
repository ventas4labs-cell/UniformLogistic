import type { SupabaseClient } from '@supabase/supabase-js';

// Tracks how much of each order line has already been pushed into the
// company's stock from Empaque. Mirrors services/dispatches.ts so the
// board can render remaining-to-add and support repeated partial adds.

export interface StockEntryLineInput {
    orderItemId: string;
    quantity: number;
}

interface StockEntryRow {
    id: string;
    order_id: string;
    items: { order_item_id: string; quantity: number }[] | null;
}

const SELECT =
    'id, order_id, items:order_stock_entry_items ( order_item_id, quantity )';

export type StockEntryTotalsByOrder = Map<string, Map<string, number>>;

export async function fetchStockEntryTotalsForOrders(
    supabase: SupabaseClient,
    orderIds: string[]
): Promise<StockEntryTotalsByOrder> {
    const out: StockEntryTotalsByOrder = new Map();
    if (orderIds.length === 0) return out;
    const { data, error } = await supabase
        .from('order_stock_entries')
        .select(SELECT)
        .in('order_id', orderIds);
    if (error) throw error;
    for (const r of (data as unknown as StockEntryRow[]) || []) {
        let perOrder = out.get(r.order_id);
        if (!perOrder) {
            perOrder = new Map();
            out.set(r.order_id, perOrder);
        }
        for (const it of r.items || []) {
            perOrder.set(
                it.order_item_id,
                (perOrder.get(it.order_item_id) || 0) + it.quantity
            );
        }
    }
    return out;
}
