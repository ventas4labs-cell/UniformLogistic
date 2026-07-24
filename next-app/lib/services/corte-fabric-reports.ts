import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Corte fabric consumption reports ────────────────────────────────
// Persistence for what the corte agent reports having spent per order,
// one row per tela. See lib/corte-fabric.ts for how the *expected*
// figure is derived from the product BOM.

export interface CorteFabricReport {
    orderId: string;
    /** '' = the "sin tela especificada" bucket. */
    fabricType: string;
    qtyUsed: number;
    unit: string;
    /** BOM estimate snapshotted when the report was saved. */
    expectedQty: number | null;
    notes: string | null;
    reportedAt: string;
}

/** order_id → its reported lines. */
export type CorteFabricByOrder = Record<string, CorteFabricReport[]>;

interface Row {
    order_id: string;
    fabric_type: string;
    qty_used: number | string;
    unit: string;
    expected_qty: number | string | null;
    notes: string | null;
    updated_at: string;
}

const toNum = (v: number | string | null): number | null =>
    v === null ? null : typeof v === 'number' ? v : Number(v);

function mapRow(r: Row): CorteFabricReport {
    return {
        orderId: r.order_id,
        fabricType: r.fabric_type,
        // numeric comes back as a string over PostgREST.
        qtyUsed: toNum(r.qty_used) ?? 0,
        unit: r.unit,
        expectedQty: toNum(r.expected_qty),
        notes: r.notes,
        reportedAt: r.updated_at
    };
}

/**
 * Reports for a set of orders, grouped by order. Chunked because the
 * boards can pass every order on the board at once.
 */
export async function fetchCorteFabricReports(
    supabase: SupabaseClient,
    orderIds: string[]
): Promise<CorteFabricByOrder> {
    const out: CorteFabricByOrder = {};
    if (orderIds.length === 0) return out;
    const CHUNK = 200;
    for (let i = 0; i < orderIds.length; i += CHUNK) {
        const { data, error } = await supabase
            .from('order_corte_fabric')
            .select('order_id, fabric_type, qty_used, unit, expected_qty, notes, updated_at')
            .in('order_id', orderIds.slice(i, i + CHUNK));
        if (error) throw error;
        for (const r of (data || []) as Row[]) {
            (out[r.order_id] ||= []).push(mapRow(r));
        }
    }
    for (const list of Object.values(out)) {
        list.sort((a, b) => a.fabricType.localeCompare(b.fabricType));
    }
    return out;
}

export interface FabricUsageEntry {
    fabricType: string;
    qtyUsed: number;
    unit: string;
    expectedQty: number | null;
    notes?: string | null;
}

/**
 * Replace an order's fabric report. Lines the operator left blank are
 * removed rather than stored as zero, so "not reported yet" and
 * "reported as 0" stay distinguishable.
 */
export async function saveCorteFabricReport(
    supabase: SupabaseClient,
    orderId: string,
    entries: FabricUsageEntry[],
    userId: string
): Promise<void> {
    const keep = entries.filter((e) => Number.isFinite(e.qtyUsed) && e.qtyUsed > 0);
    const kept = new Set(keep.map((e) => e.fabricType));

    // Drop the lines that are no longer reported. We read the existing
    // telas and delete those by name rather than filtering with a
    // negated `in`: tela names contain spaces and sometimes inches
    // (`Ripstop 60"`), and letting supabase-js encode an explicit value
    // list avoids hand-rolling PostgREST's quoting rules.
    const { data: existing, error: readError } = await supabase
        .from('order_corte_fabric')
        .select('fabric_type')
        .eq('order_id', orderId);
    if (readError) throw readError;
    const stale = ((existing || []) as { fabric_type: string }[])
        .map((r) => r.fabric_type)
        .filter((t) => !kept.has(t));
    if (stale.length > 0) {
        const { error: delError } = await supabase
            .from('order_corte_fabric')
            .delete()
            .eq('order_id', orderId)
            .in('fabric_type', stale);
        if (delError) throw delError;
    }

    if (keep.length === 0) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('order_corte_fabric').upsert(
        keep.map((e) => ({
            order_id: orderId,
            fabric_type: e.fabricType,
            qty_used: Math.round(e.qtyUsed * 100) / 100,
            unit: e.unit || 'm',
            expected_qty:
                e.expectedQty === null || e.expectedQty === undefined
                    ? null
                    : Math.round(e.expectedQty * 100) / 100,
            notes: e.notes?.trim() || null,
            reported_by: userId,
            updated_at: now
        })),
        { onConflict: 'order_id,fabric_type' }
    );
    if (error) throw error;
}
