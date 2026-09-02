import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Punch events + the daily punch state machine ───────────────────
// Employees punch in/out plus break and lunch start/end. Worked hours
// are derived from ordered pairs (Phase 3). Times are bucketed by the
// Costa Rica calendar day (UTC-6, no DST).

export type PunchType =
    | 'in'
    | 'out'
    | 'break_start'
    | 'break_end'
    | 'lunch_start'
    | 'lunch_end';

export type PunchState = 'out' | 'working' | 'on_break' | 'on_lunch';

export interface Punch {
    id: string;
    punchType: PunchType;
    punchedAt: string;
}

export const PUNCH_LABELS: Record<PunchType, string> = {
    in: 'Entrada',
    out: 'Salida',
    break_start: 'Inicio de break',
    break_end: 'Fin de break',
    lunch_start: 'Inicio de almuerzo',
    lunch_end: 'Fin de almuerzo'
};

export const STATE_LABELS: Record<PunchState, string> = {
    out: 'Fuera',
    working: 'Trabajando',
    on_break: 'En break',
    on_lunch: 'En almuerzo'
};

export interface PunchAction {
    type: PunchType;
    label: string;
}

/** Current state from the last punch of the day (null → no punches). */
export function deriveState(lastType: PunchType | null): PunchState {
    switch (lastType) {
        case 'in':
        case 'break_end':
        case 'lunch_end':
            return 'working';
        case 'break_start':
            return 'on_break';
        case 'lunch_start':
            return 'on_lunch';
        case 'out':
        default:
            return 'out';
    }
}

/** The punches that are legal from a given state (drives the buttons). */
export function nextActions(state: PunchState): PunchAction[] {
    switch (state) {
        case 'out':
            return [{ type: 'in', label: 'Marcar entrada' }];
        case 'working':
            return [
                { type: 'out', label: 'Marcar salida' },
                { type: 'break_start', label: 'Iniciar break' },
                { type: 'lunch_start', label: 'Iniciar almuerzo' }
            ];
        case 'on_break':
            return [{ type: 'break_end', label: 'Terminar break' }];
        case 'on_lunch':
            return [{ type: 'lunch_end', label: 'Terminar almuerzo' }];
    }
}

export function isValidTransition(state: PunchState, type: PunchType): boolean {
    return nextActions(state).some((a) => a.type === type);
}

export function lastPunchType(punches: Punch[]): PunchType | null {
    return punches.length ? punches[punches.length - 1].punchType : null;
}

// Costa Rica is a fixed UTC-6 (no DST), so a calendar day maps to a
// clean UTC window: [date 06:00Z, next-date 06:00Z).
const CR_OFFSET_MS = 6 * 60 * 60 * 1000;

export function crDayRangeUtc(nowMs: number): { start: string; end: string } {
    const cr = new Date(nowMs - CR_OFFSET_MS); // read CR wall-clock via UTC getters
    const startMs =
        Date.UTC(cr.getUTCFullYear(), cr.getUTCMonth(), cr.getUTCDate()) +
        CR_OFFSET_MS;
    return {
        start: new Date(startMs).toISOString(),
        end: new Date(startMs + 24 * 60 * 60 * 1000).toISOString()
    };
}

/** Current Costa Rica calendar date as "YYYY-MM-DD". */
export function crTodayStr(nowMs: number): string {
    return new Date(nowMs - CR_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today (CR) — reads the clock here so server components don't. */
export function crToday(): string {
    return crTodayStr(Date.now());
}

/** Shift a "YYYY-MM-DD" date by n days (pure). */
export function addDaysStr(dateStr: string, n: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** UTC window [start,end) covering a given CR calendar date. */
export function crDayRangeForDate(dateStr: string): { start: string; end: string } {
    const [y, m, d] = dateStr.split('-').map(Number);
    const startMs = Date.UTC(y, m - 1, d) + CR_OFFSET_MS;
    return {
        start: new Date(startMs).toISOString(),
        end: new Date(startMs + 24 * 60 * 60 * 1000).toISOString()
    };
}

/** Weekday of a CR date string (0=Sun … 6=Sat). */
export function crWeekday(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export interface PunchWithEmployee extends Punch {
    employeeId: string;
}

/** All punches on a given CR date, across employees (admin dashboard). */
export async function fetchPunchesForDate(
    supabase: SupabaseClient,
    dateStr: string
): Promise<PunchWithEmployee[]> {
    const { start, end } = crDayRangeForDate(dateStr);
    const { data, error } = await supabase
        .from('hr_punches')
        .select('id, employee_id, punch_type, punched_at')
        .gte('punched_at', start)
        .lt('punched_at', end)
        .order('punched_at', { ascending: true });
    if (error) {
        if ((error as { code?: string }).code === '42P01') return [];
        throw error;
    }
    return (
        (data || []) as {
            id: string;
            employee_id: string;
            punch_type: PunchType;
            punched_at: string;
        }[]
    ).map((r) => ({
        id: r.id,
        employeeId: r.employee_id,
        punchType: r.punch_type,
        punchedAt: r.punched_at
    }));
}

interface RawPunch {
    id: string;
    punch_type: PunchType;
    punched_at: string;
}

/** Today's punches for one employee, ordered ascending. */
export async function fetchTodayPunches(
    supabase: SupabaseClient,
    employeeId: string
): Promise<Punch[]> {
    const { start, end } = crDayRangeUtc(Date.now());
    const { data, error } = await supabase
        .from('hr_punches')
        .select('id, punch_type, punched_at')
        .eq('employee_id', employeeId)
        .gte('punched_at', start)
        .lt('punched_at', end)
        .order('punched_at', { ascending: true });
    if (error) {
        if ((error as { code?: string }).code === '42P01') return [];
        throw error;
    }
    return ((data || []) as RawPunch[]).map((r) => ({
        id: r.id,
        punchType: r.punch_type,
        punchedAt: r.punched_at
    }));
}

/** Insert a punch (service-role; employee_id comes from the verified
 *  session in the action). Returns the stored row. */
export async function insertPunch(
    serviceSupabase: SupabaseClient,
    input: { employeeId: string; punchType: PunchType; qrTokenId: string | null }
): Promise<Punch> {
    const { data, error } = await serviceSupabase
        .from('hr_punches')
        .insert({
            employee_id: input.employeeId,
            punch_type: input.punchType,
            qr_token_id: input.qrTokenId
        })
        .select('id, punch_type, punched_at')
        .single();
    if (error) throw error;
    const r = data as RawPunch;
    return { id: r.id, punchType: r.punch_type, punchedAt: r.punched_at };
}
