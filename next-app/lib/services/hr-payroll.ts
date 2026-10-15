import type { SupabaseClient } from '@supabase/supabase-js';
import { computeDaySummary, parseHHMM } from './hr-attendance';
import { addDaysStr, crDateOf, crWeekday, type Punch } from './hr-punches';
import { DEFAULT_SCHEDULE, scheduleInputError, type Schedule } from './hr-schedules';
import { timeOffOn, type TimeOffKind, type TimeOffRequest } from './hr-time-off';

// ─── Payroll (planilla): punched hours × hourly rate ────────────────
// Salario bruto per CR calendar day, summed over the pay period:
//
//   turno      = closed entrada→salida sessions, including all breaks
//                and lunch; gaps between separate sessions are excluded.
//   ordinarias = turno up to the scheduled daily duration (salida −
//                entrada) on a workday; 0 on a scheduled day off.
//   extra      = the rest, paid at 1.5× the hourly rate.
//
// Gross only — no CCSS / renta deductions, feriados, or vacation pay.
// A day that is still open (no salida) pays nothing until it's closed
// or corrected, so a forgotten marcaje can't turn into invented hours.

export const OVERTIME_MULTIPLIER = 1.5;

const DEFAULT_SHIFT_MIN =
    parseHHMM(DEFAULT_SCHEDULE.endTime) - parseHHMM(DEFAULT_SCHEDULE.startTime);

// ─── Rates ──────────────────────────────────────────────────────────

export interface PayRate {
    employeeId: string;
    /** Colones per hour. */
    hourlyRate: number;
    /** CR date ("YYYY-MM-DD") the rate applies from. */
    effectiveFrom: string;
}

interface RawRate {
    employee_id: string;
    hourly_rate: number | string;
    effective_from: string;
}

/** Every rate, grouped by employee, oldest first. */
export async function fetchPayRates(
    supabase: SupabaseClient
): Promise<Record<string, PayRate[]>> {
    const { data, error } = await supabase
        .from('hr_pay_rates')
        .select('employee_id, hourly_rate, effective_from')
        .order('effective_from', { ascending: true });
    if (error) {
        // Migration 0054 not applied yet → nobody has a rate.
        if ((error as { code?: string }).code === '42P01') return {};
        throw error;
    }
    const map: Record<string, PayRate[]> = {};
    for (const r of (data || []) as RawRate[]) {
        (map[r.employee_id] ||= []).push({
            employeeId: r.employee_id,
            hourlyRate: Number(r.hourly_rate),
            effectiveFrom: r.effective_from
        });
    }
    return map;
}

/**
 * The rate entry in force on a CR date: the latest one that started on
 * or before it. Days before the first entry use the first one — no rate
 * existed yet, and the hours an employee worked before the admin typed
 * one in still have to be paid. `rates` must be oldest first.
 */
export function rateEntryOn(
    rates: PayRate[] | undefined,
    dateStr: string
): PayRate | null {
    if (!rates?.length) return null;
    let entry = rates[0];
    for (const r of rates) {
        if (r.effectiveFrom > dateStr) break;
        entry = r;
    }
    return entry;
}

/** A change saved ahead of time (e.g. a raise that starts next month). */
export function upcomingRate(
    rates: PayRate[] | undefined,
    dateStr: string
): PayRate | null {
    return rates?.find((r) => r.effectiveFrom > dateStr) || null;
}

/** Service-role write. Saving the same date again replaces that entry. */
export async function upsertPayRate(
    serviceSupabase: SupabaseClient,
    input: {
        employeeId: string;
        hourlyRate: number;
        effectiveFrom: string;
        createdBy: string | null;
    }
): Promise<void> {
    const { error } = await serviceSupabase.from('hr_pay_rates').upsert(
        {
            employee_id: input.employeeId,
            hourly_rate: input.hourlyRate,
            effective_from: input.effectiveFrom,
            created_by: input.createdBy
        },
        { onConflict: 'employee_id,effective_from' }
    );
    if (error) throw error;
}

// ─── Pay periods ────────────────────────────────────────────────────

export type PayPeriodKind = 'semana' | 'quincena' | 'mes';

export const PAY_PERIOD_KINDS: PayPeriodKind[] = ['semana', 'quincena', 'mes'];

export const PAY_PERIOD_LABELS: Record<PayPeriodKind, string> = {
    semana: 'Semana',
    quincena: 'Quincena',
    mes: 'Mes'
};

export interface PayPeriod {
    kind: PayPeriodKind;
    /** First and last CR date, inclusive. */
    start: string;
    end: string;
}

const lastDayOfMonth = (y: number, m: number) =>
    String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0');

/** The period of the given kind containing a CR date. Weeks run Monday
 *  to Sunday (like "Mis horas"); quincenas are 1–15 and 16–end. */
export function payPeriodFor(kind: PayPeriodKind, dateStr: string): PayPeriod {
    const [y, m, d] = dateStr.split('-').map(Number);
    const month = dateStr.slice(0, 8); // "YYYY-MM-"
    switch (kind) {
        case 'semana': {
            const start = addDaysStr(dateStr, -((crWeekday(dateStr) + 6) % 7));
            return { kind, start, end: addDaysStr(start, 6) };
        }
        case 'quincena':
            return d <= 15
                ? { kind, start: `${month}01`, end: `${month}15` }
                : { kind, start: `${month}16`, end: `${month}${lastDayOfMonth(y, m)}` };
        case 'mes':
            return { kind, start: `${month}01`, end: `${month}${lastDayOfMonth(y, m)}` };
    }
}

// ─── Computation ────────────────────────────────────────────────────

export type PayDayStatus =
    /** Closed day — counted. */
    | 'paid'
    /** Today and still clocked in — counted once they clock out. */
    | 'open'
    /** Past day missing its salida (or entrada) — not counted until the
     *  admin corrects it. */
    | 'incomplete'
    /** Approved time off with no punches — shown, not paid. */
    | 'leave';

export interface PayDay {
    date: string;
    status: PayDayStatus;
    firstIn: string | null;
    lastOut: string | null;
    /** Asistencia's "Trabajado" (0 unless the day is paid). */
    workedMin: number;
    shiftMin: number;
    paidBreakMin: number;
    paidLunchMin: number;
    regularMin: number;
    /** Recorded shift minutes beyond the scheduled duration or on a day off. */
    overtimeMin: number;
    /** Not one of the schedule's workdays. */
    dayOff: boolean;
    hourlyRate: number | null;
    /** Céntimos, rounded per day so every total adds up exactly. */
    regularPay: number;
    overtimePay: number;
    leaveKind: TimeOffKind | null;
}

export interface EmployeePayroll {
    days: PayDay[];
    regularMin: number;
    overtimeMin: number;
    daysPaid: number;
    /** Past days that can't be paid until their punches are corrected. */
    incompleteDates: string[];
    openToday: boolean;
    leaveDays: number;
    /** Distinct rates applied in the period, in date order. */
    rates: number[];
    /** Céntimos; null when the employee has no hourly rate yet. */
    regularPay: number | null;
    overtimePay: number | null;
    grossPay: number | null;
    /** No schedule saved — the default 8:00–17:00, L–V jornada applies. */
    usesDefaultSchedule: boolean;
    /** An invalid saved schedule uses the default 9 h shift instead. */
    invalidSchedule: boolean;
}

/** Paid duration of a full shift. Breaks and lunch are included. */
export function scheduledJornadaMin(
    schedule: Pick<Schedule, 'startTime' | 'endTime'>
): number | null {
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!time.test(schedule.startTime) || !time.test(schedule.endTime)) return null;
    const min =
        parseHHMM(schedule.endTime) - parseHHMM(schedule.startTime);
    return min > 0 ? min : null;
}

const emptyDay = (date: string, status: PayDayStatus): PayDay => ({
    date,
    status,
    firstIn: null,
    lastOut: null,
    workedMin: 0,
    shiftMin: 0,
    paidBreakMin: 0,
    paidLunchMin: 0,
    regularMin: 0,
    overtimeMin: 0,
    dayOff: false,
    hourlyRate: null,
    regularPay: 0,
    overtimePay: 0,
    leaveKind: null
});

export function computeEmployeePayroll(input: {
    /** The employee's punches in the period, oldest first. */
    punches: Punch[];
    schedule: Schedule | null;
    /** The employee's rates, oldest first. */
    rates: PayRate[] | undefined;
    /** The employee's approved time off overlapping the period. */
    leave: TimeOffRequest[];
    period: PayPeriod;
    today: string;
}): EmployeePayroll {
    const { punches, schedule, rates, leave, period, today } = input;
    const invalidSchedule = !!schedule && scheduleInputError(schedule) != null;
    const effective: Schedule = schedule && !invalidSchedule
        ? schedule : { employeeId: '', ...DEFAULT_SCHEDULE };
    const workdayCap = scheduledJornadaMin(effective) ?? DEFAULT_SHIFT_MIN;
    const hasRate = !!rates?.length;

    const byDate = new Map<string, Punch[]>();
    for (const p of punches) {
        const d = crDateOf(p.punchedAt);
        const arr = byDate.get(d) || [];
        arr.push(p);
        byDate.set(d, arr);
    }

    const days: PayDay[] = [];
    const lastDay = period.end < today ? period.end : today;
    for (let date = period.start; date <= lastDay; date = addDaysStr(date, 1)) {
        const dayPunches = byDate.get(date) || [];
        const request = timeOffOn(leave, date);

        if (dayPunches.length === 0) {
            if (request) days.push({ ...emptyDay(date, 'leave'), leaveKind: request.kind });
            continue;
        }

        const weekday = crWeekday(date);
        const summary = computeDaySummary(dayPunches, effective, {
            weekday,
            isPast: date < today,
            onLeave: !!request
        });

        if (summary.open || summary.workedMin == null) {
            days.push({
                ...emptyDay(date, date < today ? 'incomplete' : 'open'),
                firstIn: summary.firstIn,
                lastOut: summary.open ? null : summary.lastOut
            });
            continue;
        }

        const dayOff = !effective.workdays.includes(weekday);
        const shiftMin = summary.shiftMin ?? 0;
        const regularMin = Math.min(shiftMin, dayOff ? 0 : workdayCap);
        const overtimeMin = shiftMin - regularMin;
        const hourlyRate = rateEntryOn(rates, date)?.hourlyRate ?? null;
        const centsPerHour = hourlyRate == null ? 0 : Math.round(hourlyRate * 100);

        days.push({
            date,
            status: 'paid',
            firstIn: summary.firstIn,
            lastOut: summary.lastOut,
            workedMin: summary.workedMin,
            shiftMin,
            paidBreakMin: summary.breakMin,
            paidLunchMin: summary.lunchMin,
            regularMin,
            overtimeMin,
            dayOff,
            hourlyRate,
            regularPay: Math.round((regularMin * centsPerHour) / 60),
            overtimePay: Math.round((overtimeMin * centsPerHour * OVERTIME_MULTIPLIER) / 60),
            leaveKind: request?.kind ?? null
        });
    }

    const paid = days.filter((d) => d.status === 'paid');
    const sum = (f: (d: PayDay) => number) => paid.reduce((acc, d) => acc + f(d), 0);
    const regularPay = sum((d) => d.regularPay);
    const overtimePay = sum((d) => d.overtimePay);
    const rateList: number[] = [];
    for (const d of paid) {
        if (d.hourlyRate != null && rateList[rateList.length - 1] !== d.hourlyRate)
            rateList.push(d.hourlyRate);
    }

    return {
        days,
        regularMin: sum((d) => d.regularMin),
        overtimeMin: sum((d) => d.overtimeMin),
        daysPaid: paid.filter((d) => d.regularMin + d.overtimeMin > 0).length,
        incompleteDates: days.filter((d) => d.status === 'incomplete').map((d) => d.date),
        openToday: days.some((d) => d.status === 'open'),
        leaveDays: days.filter((d) => d.status === 'leave').length,
        rates: rateList,
        regularPay: hasRate ? regularPay : null,
        overtimePay: hasRate ? overtimePay : null,
        grossPay: hasRate ? regularPay + overtimePay : null,
        usesDefaultSchedule: !schedule,
        invalidSchedule
    };
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

/** "28 set 2026" / "28 set" for a CR date. Fixed strings instead of Intl
 *  so a client component's server render and hydration always agree. */
export function fmtDate(dateStr: string, withYear = true): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${d} ${MONTHS_SHORT[m - 1]}${withYear ? ` ${y}` : ''}`;
}

/** "₡12 345,67" — payroll shows céntimos so rows add up to the total. */
export function fmtColones(cents: number): string {
    return new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: 'CRC',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(cents / 100);
}

/** Hourly rate for display: "₡2 500" or "₡2 187,50". */
export function fmtRate(colones: number): string {
    return new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: 'CRC',
        minimumFractionDigits: Number.isInteger(colones) ? 0 : 2,
        maximumFractionDigits: 2
    }).format(colones);
}
