import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Per-stage order completion ──────────────────────────────────────
// Four operations boards (Bodega / Corte / Maquila / Impresión) run in
// parallel. Each order becomes visible on every board the moment it's
// created. A stage marks itself "Completado" independently of the
// others. /admin/orders shows a per-order 4-cell strip aggregating
// these completions.

export type StageKey =
    | 'bodega'
    | 'corte'
    | 'maquila'
    | 'impresion'
    | 'bordado'
    | 'empaque'
    | 'ploter';

// Display / completion order. The pipeline is parallel — every order
// is visible on every board from creation — but this array drives the
// left-to-right rendering of the completion strip and control panel.
export const STAGE_ORDER: StageKey[] = [
    'bodega',
    'corte',
    'maquila',
    'impresion',
    'bordado',
    'empaque',
    'ploter'
];

export const STAGE_LABELS: Record<StageKey, string> = {
    bodega: 'Bodega',
    corte: 'Corte',
    maquila: 'Maquila',
    impresion: 'Impresión',
    bordado: 'Bordado',
    empaque: 'Empaque',
    ploter: 'Ploter'
};

export interface StageCompletion {
    orderId: string;
    stage: StageKey;
    completedAt: string;
    completedBy: string | null;
    notes: string | null;
}

interface RawRow {
    order_id: string;
    stage: string;
    completed_at: string;
    completed_by: string | null;
    notes: string | null;
}

const mapRow = (r: RawRow): StageCompletion => ({
    orderId: r.order_id,
    stage: r.stage as StageKey,
    completedAt: r.completed_at,
    completedBy: r.completed_by,
    notes: r.notes
});

/**
 * Map<orderId, Map<stage, StageCompletion>>.
 * Empty map for orders with no completions yet.
 */
export type CompletionIndex = Map<string, Map<StageKey, StageCompletion>>;

export async function fetchStageCompletionsForOrders(
    supabase: SupabaseClient,
    orderIds: string[]
): Promise<CompletionIndex> {
    const index: CompletionIndex = new Map();
    if (orderIds.length === 0) return index;

    const { data, error } = await supabase
        .from('order_stage_completions')
        .select('order_id, stage, completed_at, completed_by, notes')
        .in('order_id', orderIds);
    if (error) throw error;

    for (const r of (data || []) as RawRow[]) {
        const c = mapRow(r);
        let perOrder = index.get(c.orderId);
        if (!perOrder) {
            perOrder = new Map();
            index.set(c.orderId, perOrder);
        }
        perOrder.set(c.stage, c);
    }
    return index;
}

/**
 * Same shape as fetchStageCompletionsForOrders but for a single stage.
 * Used by the stage boards (each board only needs its own column).
 */
export async function fetchStageCompletions(
    supabase: SupabaseClient,
    stage: StageKey
): Promise<Set<string>> {
    const { data, error } = await supabase
        .from('order_stage_completions')
        .select('order_id')
        .eq('stage', stage);
    if (error) throw error;
    return new Set((data || []).map((r: { order_id: string }) => r.order_id));
}

export async function markStageComplete(
    supabase: SupabaseClient,
    orderId: string,
    stage: StageKey,
    userId: string,
    notes?: string
): Promise<void> {
    // upsert so re-completing (after un-marking) doesn't error on the
    // primary-key collision.
    const { error } = await supabase
        .from('order_stage_completions')
        .upsert(
            {
                order_id: orderId,
                stage,
                completed_by: userId,
                completed_at: new Date().toISOString(),
                notes: notes || null
            },
            { onConflict: 'order_id,stage' }
        );
    if (error) throw error;
}

export async function unmarkStageComplete(
    supabase: SupabaseClient,
    orderId: string,
    stage: StageKey
): Promise<void> {
    const { error } = await supabase
        .from('order_stage_completions')
        .delete()
        .eq('order_id', orderId)
        .eq('stage', stage);
    if (error) throw error;
}
