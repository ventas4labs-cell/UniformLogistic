import type { SupabaseClient } from '@supabase/supabase-js';

export type Stage = 'bodega' | 'corte' | 'maquila' | 'impresion' | 'empaque';

export interface StageNotification {
    id: string;
    orderId: string;
    stage: Stage;
    message: string | null;
    createdAt: string;
    acknowledgedAt: string | null;
}

interface RawRow {
    id: string;
    order_id: string;
    stage: string;
    message: string | null;
    created_at: string;
    acknowledged_at: string | null;
}

const mapRow = (r: RawRow): StageNotification => ({
    id: r.id,
    orderId: r.order_id,
    stage: r.stage as Stage,
    message: r.message,
    createdAt: r.created_at,
    acknowledgedAt: r.acknowledged_at
});

export async function fetchAllStageNotifications(
    supabase: SupabaseClient
): Promise<StageNotification[]> {
    const { data, error } = await supabase
        .from('stage_notifications')
        .select('id, order_id, stage, message, created_at, acknowledged_at')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data || []) as RawRow[]).map(mapRow);
}

export async function createStageNotification(
    supabase: SupabaseClient,
    input: { orderId: string; stage: Stage; message?: string; createdBy: string }
): Promise<StageNotification> {
    const { data, error } = await supabase
        .from('stage_notifications')
        .insert({
            order_id: input.orderId,
            stage: input.stage,
            message: input.message || null,
            created_by: input.createdBy
        })
        .select('id, order_id, stage, message, created_at, acknowledged_at')
        .single();
    if (error) throw error;
    return mapRow(data as RawRow);
}

export async function acknowledgeStageNotification(
    supabase: SupabaseClient,
    notificationId: string,
    userId: string
): Promise<void> {
    const { error } = await supabase
        .from('stage_notifications')
        .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: userId })
        .eq('id', notificationId);
    if (error) throw error;
}

export async function unacknowledgeStageNotification(
    supabase: SupabaseClient,
    notificationId: string
): Promise<void> {
    const { error } = await supabase
        .from('stage_notifications')
        .update({ acknowledged_at: null, acknowledged_by: null })
        .eq('id', notificationId);
    if (error) throw error;
}
