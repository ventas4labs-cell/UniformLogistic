import type { SupabaseClient } from '@supabase/supabase-js';

export interface InsumoCompletion {
    orderId: string;
    insumoName: string;
}

interface RawCompletionRow {
    order_id: string;
    insumo_name: string;
}

export async function fetchCompletionsForOrders(
    supabase: SupabaseClient,
    orderIds: string[]
): Promise<InsumoCompletion[]> {
    if (orderIds.length === 0) return [];
    const { data, error } = await supabase
        .from('insumo_completions')
        .select('order_id, insumo_name')
        .in('order_id', orderIds);
    if (error) throw error;
    return ((data || []) as RawCompletionRow[]).map((r) => ({
        orderId: r.order_id,
        insumoName: r.insumo_name,
    }));
}

export async function markInsumoComplete(
    supabase: SupabaseClient,
    orderId: string,
    insumoName: string,
    userId: string
): Promise<void> {
    const { error } = await supabase
        .from('insumo_completions')
        .upsert(
            { order_id: orderId, insumo_name: insumoName, completed_by: userId },
            { onConflict: 'order_id,insumo_name' }
        );
    if (error) throw error;
}

export async function unmarkInsumoComplete(
    supabase: SupabaseClient,
    orderId: string,
    insumoName: string
): Promise<void> {
    const { error } = await supabase
        .from('insumo_completions')
        .delete()
        .eq('order_id', orderId)
        .eq('insumo_name', insumoName);
    if (error) throw error;
}
