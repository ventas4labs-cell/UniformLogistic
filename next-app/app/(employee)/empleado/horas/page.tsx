import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { fetchSchedule } from '@/lib/services/hr-schedules';
import {
    addDaysStr,
    crDateOf,
    crToday,
    crWeekday,
    fetchPunchesInRange,
    PUNCH_LABELS,
    type Punch
} from '@/lib/services/hr-punches';
import {
    computeDaySummary,
    fmtHm,
    FLAG_LABELS,
    type DayFlag
} from '@/lib/services/hr-attendance';
import {
    fetchApprovedTimeOffInRange,
    KIND_LABELS,
    timeOffOn
} from '@/lib/services/hr-time-off';

export const dynamic = 'force-dynamic';

// Read-only weekly view of the employee's own punches. Nothing on this
// page (or anywhere in the portal) can change a recorded time; a wrong
// marcaje is corrected by the admin.

const RED_FLAGS: DayFlag[] = ['late', 'absent', 'missing_out'];

const fmtTime = (iso: string | null) =>
    iso
        ? new Date(iso).toLocaleTimeString('es-CR', {
              timeZone: 'America/Costa_Rica',
              hour: '2-digit',
              minute: '2-digit'
          })
        : '—';

const fmtDay = (dateStr: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('es-CR', {
        timeZone: 'America/Costa_Rica',
        ...opts
    });

function fmtPeriod(min: number, count: number, isOpen: boolean): string {
    if (isOpen) return 'en curso';
    if (count === 0) return '—';
    if (min < 1) return '<1 min';
    return fmtHm(min);
}

const isValidDate = (s: string | undefined): s is string =>
    !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Monday of the week containing dateStr. */
const mondayOf = (dateStr: string) =>
    addDaysStr(dateStr, -((crWeekday(dateStr) + 6) % 7));

export default async function HorasPage({
    searchParams
}: {
    searchParams: Promise<{ w?: string }>;
}) {
    const { w } = await searchParams;
    const today = crToday();
    const thisMonday = mondayOf(today);
    const monday = isValidDate(w) && w <= today ? mondayOf(w) : thisMonday;
    const nextMonday = addDaysStr(monday, 7);
    const sunday = addDaysStr(monday, 6);

    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const [punches, schedule, leave] = await Promise.all([
        fetchPunchesInRange(supabase, user.id, monday, nextMonday),
        fetchSchedule(supabase, user.id),
        fetchApprovedTimeOffInRange(supabase, monday, sunday, user.id)
    ]);

    const byDate = new Map<string, Punch[]>();
    for (const p of punches) {
        const d = crDateOf(p.punchedAt);
        const arr = byDate.get(d) || [];
        arr.push(p);
        byDate.set(d, arr);
    }

    const days = Array.from({ length: 7 }, (_, i) => {
        const date = addDaysStr(monday, i);
        const weekday = crWeekday(date);
        const dayPunches = byDate.get(date) || [];
        const onLeave = timeOffOn(leave, date);
        return {
            date,
            punches: dayPunches,
            future: date > today,
            scheduled: !!schedule && schedule.workdays.includes(weekday),
            onLeave,
            summary: computeDaySummary(dayPunches, schedule, {
                weekday,
                isPast: date < today,
                onLeave: !!onLeave
            })
        };
    });

    const totalMin = days.reduce((sum, d) => sum + (d.summary.workedMin || 0), 0);
    const daysWorked = days.filter((d) => d.summary.firstIn).length;
    const rangeLabel = `${fmtDay(monday, { day: 'numeric', month: 'short' })} – ${fmtDay(sunday, { day: 'numeric', month: 'short' })}`;

    const navCls =
        'p-2 text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800';

    return (
        <div className="space-y-5">
            <div className="flex items-end justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Mis horas</h1>
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Semana del {rangeLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                    {monday !== thisMonday && (
                        <Link
                            href="/empleado/horas"
                            className="px-3 py-1.5 text-sm font-bold text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-800 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/40"
                        >
                            Esta semana
                        </Link>
                    )}
                    <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
                        <Link
                            href={`/empleado/horas?w=${addDaysStr(monday, -7)}`}
                            className={navCls}
                            aria-label="Semana anterior"
                        >
                            <ChevronLeft size={16} />
                        </Link>
                        {monday < thisMonday ? (
                            <Link
                                href={`/empleado/horas?w=${nextMonday}`}
                                className={navCls}
                                aria-label="Semana siguiente"
                            >
                                <ChevronRight size={16} />
                            </Link>
                        ) : (
                            <span className="p-2 text-gray-300 dark:text-zinc-700" aria-hidden="true">
                                <ChevronRight size={16} />
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Trabajado</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-1 tabular-nums">{fmtHm(totalMin)}</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Días marcados</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-1 tabular-nums">{daysWorked}</p>
                </div>
            </div>

            <ul className="space-y-2">
                {days.map(({ date, punches: dayPunches, future, scheduled, onLeave, summary }) => {
                    const hasPunches = dayPunches.length > 0;
                    const muted = future || (!hasPunches && !scheduled && !onLeave);
                    return (
                        <li
                            key={date}
                            className={`bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 px-4 py-3 ${
                                date === today ? 'ring-2 ring-orange-500/40' : ''
                            }`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className={`font-semibold capitalize ${muted ? 'text-gray-400 dark:text-zinc-500' : 'text-gray-900 dark:text-zinc-100'}`}>
                                    {fmtDay(date, { weekday: 'long', day: 'numeric', month: 'short' })}
                                    {date === today && (
                                        <span className="ml-2 text-xs font-bold text-orange-600 dark:text-orange-400 normal-case">Hoy</span>
                                    )}
                                </span>
                                <span className="font-bold tabular-nums text-gray-900 dark:text-zinc-100">
                                    {onLeave && !hasPunches ? (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300">
                                            {KIND_LABELS[onLeave.kind]}
                                        </span>
                                    ) : summary.open ? (
                                        <span className="text-green-600 dark:text-green-400 text-sm">En curso</span>
                                    ) : hasPunches ? (
                                        fmtHm(summary.workedMin)
                                    ) : future ? (
                                        ''
                                    ) : scheduled ? (
                                        <span className="text-gray-400 dark:text-zinc-500 font-normal text-sm">Sin marcas</span>
                                    ) : (
                                        <span className="text-gray-400 dark:text-zinc-500 font-normal text-sm">Libre</span>
                                    )}
                                </span>
                            </div>

                            {hasPunches && (
                                <>
                                    <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-zinc-400">
                                        <span>Entrada <span className="font-mono text-gray-800 dark:text-zinc-200">{fmtTime(summary.firstIn)}</span></span>
                                        <span>Salida <span className="font-mono text-gray-800 dark:text-zinc-200">{summary.open ? '—' : fmtTime(summary.lastOut)}</span></span>
                                        <span>Break <span className="text-gray-800 dark:text-zinc-200">{fmtPeriod(summary.breakMin, summary.breakCount, summary.breakOpen)}</span></span>
                                        <span>Almuerzo <span className="text-gray-800 dark:text-zinc-200">{fmtPeriod(summary.lunchMin, summary.lunchCount, summary.lunchOpen)}</span></span>
                                    </div>
                                    <details className="mt-2">
                                        <summary className="text-xs font-semibold text-orange-700 dark:text-orange-400 cursor-pointer select-none">
                                            Ver marcajes ({dayPunches.length})
                                        </summary>
                                        <ul className="mt-1.5 space-y-1">
                                            {dayPunches.map((p) => (
                                                <li key={p.id} className="flex items-center justify-between text-xs">
                                                    <span className="text-gray-700 dark:text-zinc-300">
                                                        {PUNCH_LABELS[p.punchType]}
                                                        {p.source === 'admin' && (
                                                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300">
                                                                Ajustado por administración
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="font-mono text-gray-500 dark:text-zinc-400">{fmtTime(p.punchedAt)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </details>
                                </>
                            )}

                            {summary.flags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {summary.flags.map((f) => (
                                        <span
                                            key={f}
                                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                                RED_FLAGS.includes(f)
                                                    ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                                                    : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                                            }`}
                                        >
                                            {FLAG_LABELS[f]}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-zinc-400">
                <Lock size={14} className="shrink-0 mt-0.5" />
                Los marcajes solo se registran escaneando el QR del taller y no se
                pueden modificar desde aquí. Si ves un error, avisale al administrador;
                las correcciones aparecen marcadas como “Ajustado por administración”.
            </p>
        </div>
    );
}
