import type { SupabaseClient } from '@supabase/supabase-js';

// Report lifecycle:
//   open      → raised by a board, waiting for admin to buy the insumo
//   purchased → admin bought it; the raising board waits to receive it
//   received  → the raising board confirmed arrival → closed
export type MissingReportStatus = 'open' | 'purchased' | 'received';

export interface MissingInsumoReport {
    id: string;
    order_id: string;
    order_ref?: string;
    company_name?: string;
    insumo_name: string;
    required_qty: number;
    missing_qty: number;
    reported_by: string;
    notes: string | null;
    // Which board raised the report (bodega/corte/maquila/…). Null for
    // legacy reports created before the stage was tracked.
    stage: string | null;
    status: MissingReportStatus;
    purchased_at: string | null;
    received_at: string | null;
    resolved: boolean;
    resolved_at: string | null;
    created_at: string;
}

interface RawReportRow {
    id: string;
    order_id: string;
    insumo_name: string;
    required_qty: number;
    missing_qty: number;
    reported_by: string;
    notes: string | null;
    stage: string | null;
    status: MissingReportStatus;
    purchased_at: string | null;
    received_at: string | null;
    resolved: boolean;
    resolved_at: string | null;
    created_at: string;
    order: { order_number: number; company: { name: string } | { name: string }[] | null } | { order_number: number; company: { name: string } | { name: string }[] | null }[] | null;
}

const formatOrderRef = (n: number) => `ORDEN-${String(n).padStart(5, '0')}`;

function pickOne<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
}

// One row selection reused by every read so the shape always matches
// RawReportRow.
const REPORT_SELECT =
    '*, order:orders ( order_number, company:companies ( name ) )';

function mapRow(row: RawReportRow): MissingInsumoReport {
    const order = pickOne(row.order);
    const company = order ? pickOne(order.company) : null;
    return {
        id: row.id,
        order_id: row.order_id,
        order_ref: order ? formatOrderRef(order.order_number) : undefined,
        company_name: company?.name ?? undefined,
        insumo_name: row.insumo_name,
        required_qty: row.required_qty,
        missing_qty: row.missing_qty,
        reported_by: row.reported_by,
        notes: row.notes,
        stage: row.stage ?? null,
        status: row.status ?? (row.resolved ? 'received' : 'open'),
        purchased_at: row.purchased_at ?? null,
        received_at: row.received_at ?? null,
        resolved: row.resolved,
        resolved_at: row.resolved_at,
        created_at: row.created_at,
    };
}

export async function createMissingReport(
    supabase: SupabaseClient,
    report: {
        order_id: string;
        insumo_name: string;
        required_qty: number;
        missing_qty: number;
        reported_by: string;
        notes?: string;
        stage?: string;
    }
): Promise<MissingInsumoReport> {
    const { data, error } = await supabase
        .from('missing_insumo_reports')
        .insert({
            order_id: report.order_id,
            insumo_name: report.insumo_name,
            required_qty: report.required_qty,
            missing_qty: report.missing_qty,
            reported_by: report.reported_by,
            notes: report.notes || null,
            stage: report.stage || null,
            status: 'open',
        })
        .select(REPORT_SELECT)
        .single();

    if (error) throw error;
    return mapRow(data as unknown as RawReportRow);
}

export async function fetchAllReports(
    supabase: SupabaseClient,
    onlyUnresolved = false
): Promise<MissingInsumoReport[]> {
    let query = supabase
        .from('missing_insumo_reports')
        .select(REPORT_SELECT)
        .order('created_at', { ascending: false });

    if (onlyUnresolved) {
        query = query.eq('resolved', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ((data || []) as unknown as RawReportRow[]).map(mapRow);
}

// ─── Lifecycle transitions ──────────────────────────────────────────
// The legacy `resolved` boolean is kept in lockstep with `status` so
// anything still reading it (older order-card badges) stays correct.

/** Admin bought the insumo: open → purchased. */
export async function markReportPurchased(
    supabase: SupabaseClient,
    reportId: string,
    userId: string
): Promise<void> {
    const { error } = await supabase
        .from('missing_insumo_reports')
        .update({
            status: 'purchased',
            purchased_at: new Date().toISOString(),
            purchased_by: userId,
            resolved: false,
            resolved_at: null,
        })
        .eq('id', reportId);
    if (error) throw error;
}

/** Raising board received the insumo: purchased → received (closed). */
export async function markReportReceived(
    supabase: SupabaseClient,
    reportId: string,
    userId: string
): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabase
        .from('missing_insumo_reports')
        .update({
            status: 'received',
            received_at: now,
            received_by: userId,
            resolved: true,
            resolved_at: now,
        })
        .eq('id', reportId);
    if (error) throw error;
}

/** Send a report back to the open queue (undo a purchase/receipt). */
export async function reopenReport(
    supabase: SupabaseClient,
    reportId: string
): Promise<void> {
    const { error } = await supabase
        .from('missing_insumo_reports')
        .update({
            status: 'open',
            purchased_at: null,
            purchased_by: null,
            received_at: null,
            received_by: null,
            resolved: false,
            resolved_at: null,
        })
        .eq('id', reportId);
    if (error) throw error;
}

// Back-compat aliases for the older order-report actions. Resolving now
// means "received"; reopening returns the report to the open queue.
export async function resolveReport(
    supabase: SupabaseClient,
    reportId: string
): Promise<void> {
    const { error } = await supabase
        .from('missing_insumo_reports')
        .update({ status: 'received', resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', reportId);
    if (error) throw error;
}

export async function unresolveReport(
    supabase: SupabaseClient,
    reportId: string
): Promise<void> {
    await reopenReport(supabase, reportId);
}

