import type { SupabaseClient } from '@supabase/supabase-js';
import type { StageKey } from '@/lib/services/stage-completions';

// ─── Per-item partial progress ───────────────────────────────────────
// Tracks how many pieces of each order line have been finished for a
// given stage (Bordado uses this). Keyed by order_item_id. The binary
// order_stage_completions row is reconciled by the server action when
// every line reaches its full quantity.

/** Map of order_item_id → qty done, for one stage. */
export type ItemProgress = Record<string, number>;

export async function fetchStageItemProgress(
    supabase: SupabaseClient,
    stage: StageKey
): Promise<ItemProgress> {
    const { data, error } = await supabase
        .from('order_stage_item_progress')
        .select('order_item_id, qty_done')
        .eq('stage', stage);
    if (error) throw error;
    const out: ItemProgress = {};
    for (const r of (data || []) as { order_item_id: string; qty_done: number }[]) {
        out[r.order_item_id] = r.qty_done;
    }
    return out;
}

export interface ProgressEntry {
    orderItemId: string;
    qtyDone: number;
}

/**
 * Upsert the per-item progress rows for one order + stage. Callers pass
 * every line of the order so the set is complete. Returns nothing —
 * completion reconciliation happens in the action.
 */
export async function saveStageItemProgress(
    supabase: SupabaseClient,
    orderId: string,
    stage: StageKey,
    entries: ProgressEntry[],
    userId: string
): Promise<void> {
    if (entries.length === 0) return;
    const rows = entries.map((e) => ({
        order_id: orderId,
        stage,
        order_item_id: e.orderItemId,
        qty_done: Math.max(0, Math.round(e.qtyDone)),
        updated_by: userId,
        updated_at: new Date().toISOString()
    }));
    const { error } = await supabase
        .from('order_stage_item_progress')
        .upsert(rows, { onConflict: 'stage,order_item_id' });
    if (error) throw error;
}
