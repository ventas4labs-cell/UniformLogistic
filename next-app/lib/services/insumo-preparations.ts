import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Per-(order, insumo) prepared-quantity tracking ──────────────────
// Bodega operator types in how much of each insumo they've pulled
// from stock for the order. The UI computes the "missing" qty as
// total_required − prepared. Storing it server-side means progress
// persists across refreshes + is visible to anyone opening the
// operator board.

export interface InsumoPreparation {
    orderId: string;
    insumoName: string;
    preparedQty: number;
    updatedAt: string;
    updatedBy: string | null;
}

interface RawRow {
    order_id: string;
    insumo_name: string;
    prepared_qty: string | number;
    updated_at: string;
    updated_by: string | null;
}

const mapRow = (r: RawRow): InsumoPreparation => ({
    orderId: r.order_id,
    insumoName: r.insumo_name,
    // Postgres numeric ships as a string over the wire — coerce here so
    // every consumer can treat it as a number.
    preparedQty: typeof r.prepared_qty === 'string' ? parseFloat(r.prepared_qty) : r.prepared_qty,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by
});

export async function fetchPreparationsForOrders(
    supabase: SupabaseClient,
    orderIds: string[]
): Promise<InsumoPreparation[]> {
    if (orderIds.length === 0) return [];
    const { data, error } = await supabase
        .from('insumo_preparations')
        .select('order_id, insumo_name, prepared_qty, updated_at, updated_by')
        .in('order_id', orderIds);
    if (error) throw error;
    return ((data || []) as RawRow[]).map(mapRow);
}

/**
 * Upsert (order, insumo) preparation. Passing qty <= 0 deletes the
 * row so we don't keep zero noise around.
 */
export async function setInsumoPreparation(
    supabase: SupabaseClient,
    orderId: string,
    insumoName: string,
    qty: number,
    userId: string
): Promise<void> {
    if (!Number.isFinite(qty) || qty <= 0) {
        const { error } = await supabase
            .from('insumo_preparations')
            .delete()
            .eq('order_id', orderId)
            .eq('insumo_name', insumoName);
        if (error) throw error;
        return;
    }
    const { error } = await supabase
        .from('insumo_preparations')
        .upsert(
            {
                order_id: orderId,
                insumo_name: insumoName,
                prepared_qty: qty,
                updated_by: userId,
                updated_at: new Date().toISOString()
            },
            { onConflict: 'order_id,insumo_name' }
        );
    if (error) throw error;
}
