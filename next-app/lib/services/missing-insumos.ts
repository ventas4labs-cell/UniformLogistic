import type { SupabaseClient } from '@supabase/supabase-js';

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
        })
        .select('*, order:orders ( order_number, company:companies ( name ) )')
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
        .select('*, order:orders ( order_number, company:companies ( name ) )')
        .order('created_at', { ascending: false });

    if (onlyUnresolved) {
        query = query.eq('resolved', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ((data || []) as unknown as RawReportRow[]).map(mapRow);
}

export async function resolveReport(
    supabase: SupabaseClient,
    reportId: string
): Promise<void> {
    const { error } = await supabase
        .from('missing_insumo_reports')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', reportId);
    if (error) throw error;
}

export async function unresolveReport(
    supabase: SupabaseClient,
    reportId: string
): Promise<void> {
    const { error } = await supabase
        .from('missing_insumo_reports')
        .update({ resolved: false, resolved_at: null })
        .eq('id', reportId);
    if (error) throw error;
}

export async function countUnresolved(
    supabase: SupabaseClient
): Promise<number> {
    const { count, error } = await supabase
        .from('missing_insumo_reports')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', false);
    if (error) throw error;
    return count || 0;
}
