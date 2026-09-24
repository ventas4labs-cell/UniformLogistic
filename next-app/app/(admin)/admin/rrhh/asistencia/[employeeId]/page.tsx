import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, History, PencilLine } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { fetchEmployee } from '@/lib/services/employees';
import { fetchSchedule } from '@/lib/services/hr-schedules';
import {
    addDaysStr,
    crHHMM,
    crToday,
    crWeekday,
    deriveState,
    fetchPunchesInRange,
    lastPunchType,
    nextActions,
    PUNCH_LABELS,
    sequenceIssues,
    STATE_LABELS
} from '@/lib/services/hr-punches';
import {
    computeDaySummary,
    fmtHm,
    FLAG_LABELS,
    type DayFlag
} from '@/lib/services/hr-attendance';
import {
    fetchApprovedTimeOffInRange,
    KIND_LABELS
} from '@/lib/services/hr-time-off';
import {
    EDIT_ACTION_LABELS,
    fetchPunchEditsForDay
} from '@/lib/services/hr-punch-edits';
import { AsistenciaNav } from '../asistencia-nav';
import { PunchEditor } from './punch-editor';

export const dynamic = 'force-dynamic';

// Per-employee, per-day punch correction. The only place a recorded
// time can change; every change needs a reason and lands in the
// history below.

const RED_FLAGS: DayFlag[] = ['late', 'absent', 'missing_out'];

const dateLabel = (dateStr: string) =>
    new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('es-CR', {
        timeZone: 'America/Costa_Rica',
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });

const fmtStamp = (iso: string) =>
    new Date(iso).toLocaleString('es-CR', {
        timeZone: 'America/Costa_Rica',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });

function fmtPeriod(min: number, count: number, isOpen: boolean): string {
    if (isOpen) return 'en curso';
    if (count === 0) return '—';
    if (min < 1) return '<1 min';
    return fmtHm(min);
}

const isValidDate = (s: string | undefined): s is string =>
    !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function CorregirMarcajesPage({
    params,
    searchParams
}: {
    params: Promise<{ employeeId: string }>;
    searchParams: Promise<{ d?: string }>;
}) {
    const [{ employeeId }, { d }] = await Promise.all([params, searchParams]);
    const today = crToday();
    const date = isValidDate(d) && d <= today ? d : today;
    const weekday = crWeekday(date);

    const supabase = await createClient();
    const employee = await fetchEmployee(supabase, employeeId);
    if (!employee) notFound();

    const [punches, schedule, leave, edits] = await Promise.all([
        fetchPunchesInRange(supabase, employeeId, date, addDaysStr(date, 1)),
        fetchSchedule(supabase, employeeId),
        fetchApprovedTimeOffInRange(supabase, date, date, employeeId),
        fetchPunchEditsForDay(supabase, employeeId, date)
    ]);

    const onLeave = leave[0] || null;
    const summary = computeDaySummary(punches, schedule, {
        weekday,
        isPast: date < today,
        onLeave: !!onLeave
    });
    const issues = sequenceIssues(punches);
    const suggestedType = nextActions(deriveState(lastPunchType(punches)))[0].type;

    const stats = [
        { label: 'Entrada', value: summary.firstIn ? crHHMM(summary.firstIn) : '—' },
        { label: 'Salida', value: summary.open ? 'En curso' : summary.lastOut ? crHHMM(summary.lastOut) : '—' },
        { label: 'Trabajado', value: fmtHm(summary.workedMin) },
        { label: 'Break', value: fmtPeriod(summary.breakMin, summary.breakCount, summary.breakOpen) },
        { label: 'Almuerzo', value: fmtPeriod(summary.lunchMin, summary.lunchCount, summary.lunchOpen) }
    ];

    const snapshot = (s: { punchType: keyof typeof PUNCH_LABELS; punchedAt: string } | null) =>
        s ? `${PUNCH_LABELS[s.punchType]} ${crHHMM(s.punchedAt)}` : '';

    return (
        <div className="max-w-3xl">
            <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
                <div>
                    <Link
                        href={`/admin/rrhh/asistencia?d=${date}`}
                        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 mb-1"
                    >
                        <ArrowLeft size={14} /> Asistencia
                    </Link>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <PencilLine size={24} className="text-orange-600 dark:text-orange-400" />
                        {employee.fullName}
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Corregir marcajes{employee.position ? ` · ${employee.position}` : ''}
                    </p>
                </div>
                <AsistenciaNav
                    date={date}
                    prevDate={addDaysStr(date, -1)}
                    nextDate={addDaysStr(date, 1)}
                    today={today}
                    label={dateLabel(date)}
                    basePath={`/admin/rrhh/asistencia/${employeeId}`}
                />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                {stats.map((s) => (
                    <div key={s.label} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 px-3 py-2.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">{s.label}</p>
                        <p className="font-semibold text-gray-900 dark:text-zinc-100 tabular-nums">{s.value}</p>
                    </div>
                ))}
            </div>

            {(summary.flags.length > 0 || onLeave) && (
                <div className="flex flex-wrap gap-1 mb-4">
                    {onLeave && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300">
                            {KIND_LABELS[onLeave.kind]}
                        </span>
                    )}
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

            {issues.length > 0 && (
                <div className="mb-4 flex items-start gap-2 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">Los marcajes de este día no siguen una secuencia válida:</p>
                        <ul className="mt-1 list-disc pl-4">
                            {issues.map(({ punch, fromState }) => (
                                <li key={punch.id}>
                                    {crHHMM(punch.punchedAt)} · {PUNCH_LABELS[punch.punchType]} llega cuando el
                                    empleado estaba “{STATE_LABELS[fromState]}”.
                                </li>
                            ))}
                        </ul>
                        <p className="mt-1 text-xs">Las horas trabajadas pueden estar mal calculadas hasta corregirlo.</p>
                    </div>
                </div>
            )}

            <PunchEditor
                // Reset any open form when the day or its punches change.
                key={`${date}:${punches.map((p) => `${p.id}${p.punchedAt}${p.punchType}`).join('|')}`}
                employeeId={employeeId}
                date={date}
                punches={punches}
                issueIds={issues.map((i) => i.punch.id)}
                suggestedType={suggestedType}
            />

            <section className="mt-6">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2 flex items-center gap-1.5">
                    <History size={14} /> Historial de correcciones
                </h3>
                {edits.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-zinc-500">Sin correcciones este día.</p>
                ) : (
                    <ul className="space-y-2">
                        {edits.map((e) => (
                            <li key={e.id} className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 px-3 py-2 text-sm">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <span className="text-gray-900 dark:text-zinc-100">
                                        <span className="font-bold">{EDIT_ACTION_LABELS[e.action]}</span>
                                        {': '}
                                        {e.action === 'update' ? (
                                            <>
                                                <span className="line-through text-gray-400 dark:text-zinc-500">{snapshot(e.before)}</span>
                                                {' → '}
                                                {snapshot(e.after)}
                                            </>
                                        ) : e.action === 'create' ? (
                                            snapshot(e.after)
                                        ) : (
                                            <span className="line-through">{snapshot(e.before)}</span>
                                        )}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-zinc-400">{fmtStamp(e.editedAt)}</span>
                                </div>
                                <p className="text-gray-500 dark:text-zinc-400 mt-0.5 break-words">Motivo: {e.reason}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
