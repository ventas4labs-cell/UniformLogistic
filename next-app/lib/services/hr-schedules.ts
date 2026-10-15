import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Per-employee work schedule ─────────────────────────────────────
// The baseline the attendance dashboard compares punches against.

export interface Schedule {
    employeeId: string;
    /** Weekday numbers the employee works. 0=Sun … 6=Sat. */
    workdays: number[];
    /** "HH:MM" (CR local). */
    startTime: string;
    endTime: string;
    lunchMin: number;
    breakMin: number;
    graceMin: number;
    tz: string;
}

export interface ScheduleInput {
    workdays: number[];
    startTime: string;
    endTime: string;
    lunchMin: number;
    breakMin: number;
    graceMin: number;
}

export const DEFAULT_SCHEDULE: Omit<Schedule, 'employeeId'> = {
    workdays: [1, 2, 3, 4, 5],
    startTime: '08:00',
    endTime: '17:00',
    lunchMin: 60,
    breakMin: 15,
    graceMin: 5,
    tz: 'America/Costa_Rica'
};

export const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Shared by profile creation, profile editing and the schedule shortcut. */
export function scheduleInputError(input: ScheduleInput): string | null {
    if (
        !Array.isArray(input.workdays) || !input.workdays.length ||
        input.workdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    ) return 'Elegí al menos un día laboral válido.';
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!time.test(input.startTime) || !time.test(input.endTime))
        return 'Definí una hora de entrada y salida válidas.';
    // Punches are grouped by calendar day, so overnight shifts aren't supported.
    if (input.endTime <= input.startTime)
        return 'La salida tiene que ser después de la entrada, dentro del mismo día.';
    if ([input.lunchMin, input.breakMin, input.graceMin].some(
        (min) => !Number.isInteger(min) || min < 0 || min > 1440
    )) return 'Almuerzo, break y tolerancia deben ser minutos enteros entre 0 y 1440.';
    return null;
}

interface RawRow {
    employee_id: string;
    workdays: number[] | null;
    start_time: string | null;
    end_time: string | null;
    lunch_min: number | null;
    break_min: number | null;
    grace_min: number | null;
    tz: string | null;
}

// Times come back as "HH:MM:SS"; trim to "HH:MM" for the inputs.
const hhmm = (t: string | null, fallback: string) =>
    t ? t.slice(0, 5) : fallback;

const mapRow = (r: RawRow): Schedule => ({
    employeeId: r.employee_id,
    workdays: r.workdays ?? DEFAULT_SCHEDULE.workdays,
    startTime: hhmm(r.start_time, DEFAULT_SCHEDULE.startTime),
    endTime: hhmm(r.end_time, DEFAULT_SCHEDULE.endTime),
    lunchMin: r.lunch_min ?? DEFAULT_SCHEDULE.lunchMin,
    breakMin: r.break_min ?? DEFAULT_SCHEDULE.breakMin,
    graceMin: r.grace_min ?? DEFAULT_SCHEDULE.graceMin,
    tz: r.tz ?? DEFAULT_SCHEDULE.tz
});

const SELECT =
    'employee_id, workdays, start_time, end_time, lunch_min, break_min, grace_min, tz';

export async function fetchSchedules(
    supabase: SupabaseClient
): Promise<Schedule[]> {
    const { data, error } = await supabase
        .from('employee_schedules')
        .select(SELECT);
    if (error) {
        if ((error as { code?: string }).code === '42P01') return [];
        throw error;
    }
    return ((data || []) as RawRow[]).map(mapRow);
}

/** One employee's schedule (null when none was set). */
export async function fetchSchedule(
    supabase: SupabaseClient,
    employeeId: string
): Promise<Schedule | null> {
    const { data, error } = await supabase
        .from('employee_schedules')
        .select(SELECT)
        .eq('employee_id', employeeId)
        .maybeSingle();
    if (error) {
        if ((error as { code?: string }).code === '42P01') return null;
        throw error;
    }
    return data ? mapRow(data as RawRow) : null;
}

/** Map of employeeId → Schedule for quick lookup in the dashboard/UI. */
export async function fetchSchedulesMap(
    supabase: SupabaseClient
): Promise<Record<string, Schedule>> {
    const rows = await fetchSchedules(supabase);
    const map: Record<string, Schedule> = {};
    for (const s of rows) map[s.employeeId] = s;
    return map;
}

export async function upsertSchedule(
    serviceSupabase: SupabaseClient,
    employeeId: string,
    input: ScheduleInput
): Promise<void> {
    const { error } = await serviceSupabase.from('employee_schedules').upsert(
        {
            employee_id: employeeId,
            workdays: input.workdays,
            start_time: input.startTime,
            end_time: input.endTime,
            lunch_min: input.lunchMin,
            break_min: input.breakMin,
            grace_min: input.graceMin,
            updated_at: new Date().toISOString()
        },
        { onConflict: 'employee_id' }
    );
    if (error) throw error;
}
