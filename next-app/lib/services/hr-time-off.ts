import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Time-off requests (vacaciones, incapacidad, permisos) ──────────
// Employees request whole days (inclusive CR calendar range); the admin
// approves or rejects. Employees only READ their rows via RLS — every
// write goes through a server action on the service-role client.

export type TimeOffKind = 'vacation' | 'sick' | 'personal' | 'other';
export type TimeOffStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export const TIME_OFF_KINDS: TimeOffKind[] = ['vacation', 'sick', 'personal', 'other'];

// Incapacidades often get filed after the fact, so employees may
// backdate a request a little; anything older is the admin's to record.
export const TIME_OFF_MAX_BACKDATE_DAYS = 30;
export const TIME_OFF_MAX_RANGE_DAYS = 60;

export const KIND_LABELS: Record<TimeOffKind, string> = {
    vacation: 'Vacaciones',
    sick: 'Incapacidad',
    personal: 'Permiso personal',
    other: 'Otro'
};

export const STATUS_LABELS: Record<TimeOffStatus, string> = {
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    cancelled: 'Cancelado'
};

export const STATUS_STYLE: Record<TimeOffStatus, string> = {
    pending: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    approved: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300',
    rejected: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300',
    cancelled: 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
};

export interface TimeOffRequest {
    id: string;
    employeeId: string;
    kind: TimeOffKind;
    /** "YYYY-MM-DD", inclusive. */
    startDate: string;
    endDate: string;
    reason: string;
    status: TimeOffStatus;
    adminNote: string;
    reviewedAt: string | null;
    createdAt: string;
}

interface RawRow {
    id: string;
    employee_id: string;
    kind: TimeOffKind;
    start_date: string;
    end_date: string;
    reason: string | null;
    status: TimeOffStatus;
    admin_note: string | null;
    reviewed_at: string | null;
    created_at: string;
}

const SELECT =
    'id, employee_id, kind, start_date, end_date, reason, status, admin_note, reviewed_at, created_at';

const mapRow = (r: RawRow): TimeOffRequest => ({
    id: r.id,
    employeeId: r.employee_id,
    kind: r.kind,
    startDate: r.start_date,
    endDate: r.end_date,
    reason: r.reason || '',
    status: r.status,
    adminNote: r.admin_note || '',
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at
});

// A missing table (migration 0045 not applied) reads as "no requests"
// instead of taking down the page, like the other HR services.
const isMissingTable = (error: unknown) =>
    (error as { code?: string }).code === '42P01';

/** Number of calendar days in an inclusive "YYYY-MM-DD" range. */
export function daysInRange(startDate: string, endDate: string): number {
    const ms = Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
    return Math.round(ms / 86400000) + 1;
}

/** One employee's requests, newest first. */
export async function fetchEmployeeTimeOff(
    supabase: SupabaseClient,
    employeeId: string
): Promise<TimeOffRequest[]> {
    const { data, error } = await supabase
        .from('hr_time_off_requests')
        .select(SELECT)
        .eq('employee_id', employeeId)
        .order('start_date', { ascending: false })
        .order('created_at', { ascending: false });
    if (error) {
        if (isMissingTable(error)) return [];
        throw error;
    }
    return ((data || []) as RawRow[]).map(mapRow);
}

/** Every request (admin), newest first. */
export async function fetchAllTimeOff(
    supabase: SupabaseClient
): Promise<TimeOffRequest[]> {
    const { data, error } = await supabase
        .from('hr_time_off_requests')
        .select(SELECT)
        .order('start_date', { ascending: false })
        .order('created_at', { ascending: false });
    if (error) {
        if (isMissingTable(error)) return [];
        throw error;
    }
    return ((data || []) as RawRow[]).map(mapRow);
}

export async function countPendingTimeOff(supabase: SupabaseClient): Promise<number> {
    const { count, error } = await supabase
        .from('hr_time_off_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
    if (error) {
        if (isMissingTable(error)) return 0;
        throw error;
    }
    return count || 0;
}

/**
 * Approved requests overlapping [fromDate, toDate] (inclusive). Pass an
 * employeeId to scope to one person (the employee hours view); omit it
 * for everyone (the admin attendance dashboard).
 */
export async function fetchApprovedTimeOffInRange(
    supabase: SupabaseClient,
    fromDate: string,
    toDate: string,
    employeeId?: string
): Promise<TimeOffRequest[]> {
    let q = supabase
        .from('hr_time_off_requests')
        .select(SELECT)
        .eq('status', 'approved')
        .lte('start_date', toDate)
        .gte('end_date', fromDate);
    if (employeeId) q = q.eq('employee_id', employeeId);
    const { data, error } = await q;
    if (error) {
        if (isMissingTable(error)) return [];
        throw error;
    }
    return ((data || []) as RawRow[]).map(mapRow);
}

/** The approved request covering a given date, if any. */
export function timeOffOn(
    requests: TimeOffRequest[],
    dateStr: string
): TimeOffRequest | null {
    return requests.find((r) => r.startDate <= dateStr && r.endDate >= dateStr) || null;
}

/** True when the employee already has a pending/approved request that
 *  overlaps the range — blocks double-booking the same days. */
export async function hasOverlappingTimeOff(
    serviceSupabase: SupabaseClient,
    employeeId: string,
    startDate: string,
    endDate: string
): Promise<boolean> {
    const { count, error } = await serviceSupabase
        .from('hr_time_off_requests')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', employeeId)
        .in('status', ['pending', 'approved'])
        .lte('start_date', endDate)
        .gte('end_date', startDate);
    if (error) throw error;
    return (count || 0) > 0;
}

export async function insertTimeOffRequest(
    serviceSupabase: SupabaseClient,
    input: {
        employeeId: string;
        kind: TimeOffKind;
        startDate: string;
        endDate: string;
        reason: string;
    }
): Promise<void> {
    const { error } = await serviceSupabase.from('hr_time_off_requests').insert({
        employee_id: input.employeeId,
        kind: input.kind,
        start_date: input.startDate,
        end_date: input.endDate,
        reason: input.reason || null
    });
    if (error) throw error;
}

/** Employee withdraws their own request. Only while still pending — the
 *  status filter makes this a no-op once the admin has decided. */
export async function cancelTimeOffRequest(
    serviceSupabase: SupabaseClient,
    id: string,
    employeeId: string
): Promise<boolean> {
    const { data, error } = await serviceSupabase
        .from('hr_time_off_requests')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('employee_id', employeeId)
        .eq('status', 'pending')
        .select('id');
    if (error) throw error;
    return (data || []).length > 0;
}

/** Admin decision. Only pending requests can be decided, so a stale tab
 *  can't flip a request the employee already cancelled. */
export async function reviewTimeOffRequest(
    serviceSupabase: SupabaseClient,
    id: string,
    input: { status: 'approved' | 'rejected'; adminNote: string; reviewedBy: string }
): Promise<boolean> {
    const { data, error } = await serviceSupabase
        .from('hr_time_off_requests')
        .update({
            status: input.status,
            admin_note: input.adminNote || null,
            reviewed_by: input.reviewedBy,
            reviewed_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id');
    if (error) throw error;
    return (data || []).length > 0;
}
