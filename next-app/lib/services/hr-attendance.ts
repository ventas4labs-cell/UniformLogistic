import type { Punch, PunchType } from './hr-punches';
import type { Schedule } from './hr-schedules';

// ─── Attendance summary + inconsistency flags ───────────────────────
// Pure functions: compute a day's worked/break/lunch totals from a
// employee's ordered punches and flag deviations from their schedule.

export type DayFlag =
    | 'late'
    | 'early'
    | 'long_break'
    | 'long_lunch'
    | 'missing_out'
    | 'absent';

export const FLAG_LABELS: Record<DayFlag, string> = {
    late: 'Llegada tarde',
    early: 'Salida temprana',
    long_break: 'Break largo',
    long_lunch: 'Almuerzo largo',
    missing_out: 'Sin marcar salida',
    absent: 'Ausente'
};

export interface DaySummary {
    firstIn: string | null;
    lastOut: string | null;
    /** Minutes worked = span(firstIn→lastOut) − break − lunch. Null when
     *  the day is still open (no clock-out). */
    workedMin: number | null;
    breakMin: number;
    lunchMin: number;
    open: boolean;
    flags: DayFlag[];
}

const CR_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Minutes since CR midnight for a timestamp. */
export function crMinutesOfDay(iso: string): number {
    const wall = new Date(new Date(iso).getTime() - CR_OFFSET_MS);
    return wall.getUTCHours() * 60 + wall.getUTCMinutes();
}

function parseHHMM(s: string): number {
    const [h, m] = s.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function diffMin(a: string, b: string): number {
    return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

export interface DayContext {
    /** Weekday of the day being summarized (0=Sun … 6=Sat). */
    weekday: number;
    /** True when the day is in the past (enables missing-out / absent). */
    isPast: boolean;
}

export function computeDaySummary(
    punches: Punch[],
    schedule: Schedule | null,
    ctx: DayContext
): DaySummary {
    let firstIn: string | null = null;
    let lastOut: string | null = null;
    let breakMin = 0;
    let lunchMin = 0;
    let openBreak: string | null = null;
    let openLunch: string | null = null;
    let lastType: PunchType | null = null;

    for (const p of punches) {
        switch (p.punchType) {
            case 'in':
                if (!firstIn) firstIn = p.punchedAt;
                break;
            case 'out':
                lastOut = p.punchedAt;
                break;
            case 'break_start':
                openBreak = p.punchedAt;
                break;
            case 'break_end':
                if (openBreak) {
                    breakMin += diffMin(openBreak, p.punchedAt);
                    openBreak = null;
                }
                break;
            case 'lunch_start':
                openLunch = p.punchedAt;
                break;
            case 'lunch_end':
                if (openLunch) {
                    lunchMin += diffMin(openLunch, p.punchedAt);
                    openLunch = null;
                }
                break;
        }
        lastType = p.punchType;
    }

    const hasPunches = punches.length > 0;
    const open = hasPunches && lastType !== 'out';
    const workedMin =
        firstIn && lastOut
            ? Math.max(0, diffMin(firstIn, lastOut) - breakMin - lunchMin)
            : null;

    const flags: DayFlag[] = [];
    const scheduledDay = !!schedule && schedule.workdays.includes(ctx.weekday);

    if (schedule) {
        const startM = parseHHMM(schedule.startTime);
        const endM = parseHHMM(schedule.endTime);
        if (firstIn && crMinutesOfDay(firstIn) > startM + schedule.graceMin)
            flags.push('late');
        if (lastOut && crMinutesOfDay(lastOut) < endM) flags.push('early');
        if (breakMin > schedule.breakMin) flags.push('long_break');
        if (lunchMin > schedule.lunchMin) flags.push('long_lunch');
    }
    if (ctx.isPast && hasPunches && open) flags.push('missing_out');
    if (ctx.isPast && scheduledDay && !hasPunches) flags.push('absent');

    return { firstIn, lastOut, workedMin, breakMin, lunchMin, open, flags };
}

export function fmtHm(min: number | null): string {
    if (min == null) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
}
