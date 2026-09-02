import Link from 'next/link';
import { ArrowLeft, CalendarClock, AlertTriangle } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { fetchEmployees } from '@/lib/services/employees';
import { fetchSchedulesMap } from '@/lib/services/hr-schedules';
import {
    addDaysStr,
    crToday,
    crWeekday,
    fetchPunchesForDate,
    type Punch
} from '@/lib/services/hr-punches';
import {
    computeDaySummary,
    fmtHm,
    FLAG_LABELS,
    type DayFlag
} from '@/lib/services/hr-attendance';
import { AsistenciaNav } from './asistencia-nav';

export const dynamic = 'force-dynamic';

const RED_FLAGS: DayFlag[] = ['late', 'absent', 'missing_out'];

const fmtTime = (iso: string | null) =>
    iso
        ? new Date(iso).toLocaleTimeString('es-CR', {
              timeZone: 'America/Costa_Rica',
              hour: '2-digit',
              minute: '2-digit'
          })
        : '—';

const dateLabel = (dateStr: string) =>
    new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('es-CR', {
        timeZone: 'America/Costa_Rica',
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });

const isValidDate = (s: string | undefined): s is string =>
    !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function AsistenciaPage({
    searchParams
}: {
    searchParams: Promise<{ d?: string }>;
}) {
    const { d } = await searchParams;
    const today = crToday();
    const date = isValidDate(d) && d <= today ? d : today;
    const isPast = date < today;
    const weekday = crWeekday(date);

    const supabase = await createClient();
    const [employees, schedulesMap, punches] = await Promise.all([
        fetchEmployees(supabase),
        fetchSchedulesMap(supabase),
        fetchPunchesForDate(supabase, date)
    ]);

    const byEmployee = new Map<string, Punch[]>();
    for (const p of punches) {
        const arr = byEmployee.get(p.employeeId) || [];
        arr.push(p);
        byEmployee.set(p.employeeId, arr);
    }

    const rows = employees
        .filter((e) => e.isActive)
        .map((e) => ({
            employee: e,
            summary: computeDaySummary(
                byEmployee.get(e.id) || [],
                schedulesMap[e.id] || null,
                { weekday, isPast }
            )
        }))
        .sort((a, b) => {
            const fa = a.summary.flags.length ? 0 : 1;
            const fb = b.summary.flags.length ? 0 : 1;
            if (fa !== fb) return fa - fb;
            return a.employee.fullName.localeCompare(b.employee.fullName);
        });

    const withFlags = rows.filter((r) => r.summary.flags.length > 0).length;

    return (
        <div>
            <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                <div>
                    <Link
                        href="/admin/rrhh"
                        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 mb-1"
                    >
                        <ArrowLeft size={14} /> Recursos Humanos
                    </Link>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <CalendarClock size={24} className="text-orange-600 dark:text-orange-400" />
                        Asistencia
                    </h2>
                </div>
                <AsistenciaNav
                    date={date}
                    prevDate={addDaysStr(date, -1)}
                    nextDate={addDaysStr(date, 1)}
                    today={today}
                    label={dateLabel(date)}
                />
            </div>

            {withFlags > 0 ? (
                <div className="mb-4 flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-3 rounded-lg text-sm border border-amber-200 dark:border-amber-900/50">
                    <AlertTriangle size={18} />
                    <span>
                        <span className="font-bold">{withFlags}</span>{' '}
                        {withFlags === 1 ? 'empleado' : 'empleados'} con novedades
                        el {dateLabel(date)}.
                    </span>
                </div>
            ) : (
                <div className="mb-4 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 p-3 rounded-lg text-sm border border-green-200 dark:border-green-900/50">
                    Sin novedades el {dateLabel(date)}.
                </div>
            )}

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-x-auto border border-gray-200 dark:border-zinc-800">
                {rows.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 dark:text-zinc-400">
                        No hay empleados activos.
                    </div>
                ) : (
                    <table className="w-full text-sm min-w-[820px]">
                        <thead className="bg-gray-50 dark:bg-zinc-900/60">
                            <tr>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Empleado</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Entrada</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Salida</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Trabajado</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Break</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Almuerzo</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Novedades</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {rows.map(({ employee, summary }) => (
                                <tr key={employee.id}>
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-gray-900 dark:text-zinc-100">{employee.fullName}</div>
                                        {employee.position && (
                                            <div className="text-[11px] text-gray-500 dark:text-zinc-500">{employee.position}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-gray-700 dark:text-zinc-300">{fmtTime(summary.firstIn)}</td>
                                    <td className="px-4 py-3 font-mono text-gray-700 dark:text-zinc-300">
                                        {summary.open ? (
                                            <span className="text-green-600 dark:text-green-400">En curso</span>
                                        ) : (
                                            fmtTime(summary.lastOut)
                                        )}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-zinc-100">{fmtHm(summary.workedMin)}</td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-zinc-400">{summary.breakMin ? fmtHm(summary.breakMin) : '—'}</td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-zinc-400">{summary.lunchMin ? fmtHm(summary.lunchMin) : '—'}</td>
                                    <td className="px-4 py-3">
                                        {summary.flags.length === 0 ? (
                                            <span className="text-gray-400 dark:text-zinc-600">—</span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
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
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

