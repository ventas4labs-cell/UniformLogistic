import Link from 'next/link';
import {
    AlertTriangle,
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Info,
    Wallet
} from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { fetchEmployees } from '@/lib/services/employees';
import { fetchSchedulesMap } from '@/lib/services/hr-schedules';
import {
    addDaysStr,
    crToday,
    fetchAllPunchesInRange,
    type Punch
} from '@/lib/services/hr-punches';
import { fmtHm } from '@/lib/services/hr-attendance';
import {
    fetchApprovedTimeOffInRange,
    type TimeOffRequest
} from '@/lib/services/hr-time-off';
import {
    computeEmployeePayroll,
    fetchPayRates,
    fmtColones,
    fmtDate,
    PAY_PERIOD_KINDS,
    PAY_PERIOD_LABELS,
    payPeriodFor,
    type PayPeriodKind
} from '@/lib/services/hr-payroll';
import { PlanillaTable, type PlanillaRow } from './planilla-table';

export const dynamic = 'force-dynamic';

// Planilla — salario bruto per employee for a week / quincena / month,
// computed from their punches and the hourly rate on their profile
// (lib/services/hr-payroll.ts has the rules). Read-only: nothing is
// stored, so a punch correction or a new rate shows up on reload.

const isValidDate = (s: string | undefined): s is string =>
    !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

const isKind = (s: string | undefined): s is PayPeriodKind =>
    PAY_PERIOD_KINDS.includes(s as PayPeriodKind);

const href = (kind: PayPeriodKind, d: string) => `/admin/rrhh/planilla?p=${kind}&d=${d}`;

function groupBy<T extends { employeeId: string }>(items: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const it of items) {
        const arr = map.get(it.employeeId) || [];
        arr.push(it);
        map.set(it.employeeId, arr);
    }
    return map;
}

export default async function PlanillaPage({
    searchParams
}: {
    searchParams: Promise<{ p?: string; d?: string }>;
}) {
    const { p, d } = await searchParams;
    const today = crToday();
    const kind: PayPeriodKind = isKind(p) ? p : 'semana';
    const period = payPeriodFor(kind, isValidDate(d) && d <= today ? d : today);
    const isCurrent = period.end >= today;
    const prev = payPeriodFor(kind, addDaysStr(period.start, -1));
    const next = payPeriodFor(kind, addDaysStr(period.end, 1));
    // Switching the period type keeps the latest day in view, so from
    // the current week you land on the current quincena / month.
    const pivot = isCurrent ? today : period.end;

    const supabase = await createClient();
    const [employees, schedules, payRates, punches, leave] = await Promise.all([
        fetchEmployees(supabase),
        fetchSchedulesMap(supabase),
        fetchPayRates(supabase),
        fetchAllPunchesInRange(supabase, period.start, addDaysStr(period.end, 1)),
        fetchApprovedTimeOffInRange(supabase, period.start, period.end)
    ]);

    const punchesBy = groupBy<Punch & { employeeId: string }>(punches);
    const leaveBy = groupBy<TimeOffRequest>(leave);

    // Inactive employees still show up when they punched in the period —
    // someone let go mid-quincena is owed those hours.
    const rows: PlanillaRow[] = employees
        .filter((e) => e.isActive || punchesBy.has(e.id))
        .map((e) => ({
            employeeId: e.id,
            fullName: e.fullName,
            position: e.position,
            isActive: e.isActive,
            payroll: computeEmployeePayroll({
                punches: punchesBy.get(e.id) || [],
                schedule: schedules[e.id] || null,
                rates: payRates[e.id],
                leave: leaveBy.get(e.id) || [],
                period,
                today
            })
        }));

    const priced = rows.filter((r) => r.payroll.grossPay != null);
    const totalGross = priced.reduce((s, r) => s + (r.payroll.grossPay || 0), 0);
    const totalOvertimePay = priced.reduce((s, r) => s + (r.payroll.overtimePay || 0), 0);
    const totalRegularMin = rows.reduce((s, r) => s + r.payroll.regularMin, 0);
    const totalOvertimeMin = rows.reduce((s, r) => s + r.payroll.overtimeMin, 0);
    const noRate = rows.filter((r) => r.payroll.grossPay == null);
    const incompleteDays = rows.reduce((s, r) => s + r.payroll.incompleteDates.length, 0);

    const label = `${fmtDate(period.start, period.start.slice(0, 4) !== period.end.slice(0, 4))} – ${fmtDate(period.end)}`;
    const navCls =
        'p-2 text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800';

    return (
        <div>
            <div className="flex items-end justify-between mb-6 gap-3 flex-wrap">
                <div>
                    <Link
                        href="/admin/rrhh"
                        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 mb-1"
                    >
                        <ArrowLeft size={14} /> Recursos Humanos
                    </Link>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <Wallet size={24} className="text-orange-600 dark:text-orange-400" />
                        Planilla
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">
                        Horas marcadas × salario por hora de cada empleado.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div
                        role="group"
                        aria-label="Tipo de periodo"
                        className="inline-flex rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900"
                    >
                        {PAY_PERIOD_KINDS.map((k) => (
                            <Link
                                key={k}
                                href={href(k, pivot)}
                                aria-current={k === kind ? 'page' : undefined}
                                className={`px-3 py-1.5 text-sm font-bold ${
                                    k === kind
                                        ? 'bg-orange-600 text-white'
                                        : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                }`}
                            >
                                {PAY_PERIOD_LABELS[k]}
                            </Link>
                        ))}
                    </div>
                    <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
                        <Link href={href(kind, prev.start)} className={navCls} aria-label="Periodo anterior">
                            <ChevronLeft size={16} />
                        </Link>
                        <span className="px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-zinc-100 min-w-[170px] text-center tabular-nums">
                            {label}
                        </span>
                        {isCurrent ? (
                            <span className="p-2 text-gray-300 dark:text-zinc-700" aria-hidden="true">
                                <ChevronRight size={16} />
                            </span>
                        ) : (
                            <Link href={href(kind, next.start)} className={navCls} aria-label="Periodo siguiente">
                                <ChevronRight size={16} />
                            </Link>
                        )}
                    </div>
                    {!isCurrent && (
                        <Link
                            href={href(kind, today)}
                            className="px-3 py-1.5 text-sm font-bold text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-800 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/40"
                        >
                            Actual
                        </Link>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Salario bruto</p>
                    <p className="font-display text-3xl font-extrabold leading-none text-gray-900 dark:text-zinc-100 mt-2 tabular-nums">
                        {fmtColones(totalGross)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                        {priced.length} {priced.length === 1 ? 'empleado' : 'empleados'}
                    </p>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Horas ordinarias</p>
                    <p className="font-display text-3xl font-extrabold leading-none text-gray-900 dark:text-zinc-100 mt-2 tabular-nums">
                        {fmtHm(totalRegularMin)}
                    </p>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Horas extra</p>
                    <p className="font-display text-3xl font-extrabold leading-none text-gray-900 dark:text-zinc-100 mt-2 tabular-nums">
                        {fmtHm(totalOvertimeMin)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                        {fmtColones(totalOvertimePay)} a 1,5×
                    </p>
                </div>
            </div>

            <div className="space-y-2 mb-4">
                {isCurrent && (
                    <div className="flex items-start gap-2 bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300 p-3 rounded-lg text-sm border border-sky-200 dark:border-sky-900/50">
                        <Info size={18} className="shrink-0 mt-px" />
                        <span>
                            Periodo en curso: calculado hasta hoy, {fmtDate(today)}. Se
                            actualiza con cada marcaje.
                        </span>
                    </div>
                )}
                {incompleteDays > 0 && (
                    <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">
                        <AlertTriangle size={18} className="shrink-0 mt-px" />
                        <span>
                            <span className="font-bold">
                                {incompleteDays} {incompleteDays === 1 ? 'día' : 'días'}
                            </span>{' '}
                            con marcas incompletas no se {incompleteDays === 1 ? 'está' : 'están'} pagando.
                            Abrí el detalle del empleado y corregí el marcaje.
                        </span>
                    </div>
                )}
                {noRate.length > 0 && (
                    <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-3 rounded-lg text-sm border border-amber-200 dark:border-amber-900/50">
                        <AlertTriangle size={18} className="shrink-0 mt-px" />
                        <span>
                            Sin salario por hora:{' '}
                            <span className="font-bold">{noRate.map((r) => r.fullName).join(', ')}</span>.
                            Sus horas no suman al total —{' '}
                            <Link href="/admin/rrhh" className="font-bold underline">
                                definilo en Recursos Humanos
                            </Link>
                            .
                        </span>
                    </div>
                )}
            </div>

            <PlanillaTable
                rows={rows}
                totals={{
                    grossPay: totalGross,
                    regularMin: totalRegularMin,
                    overtimeMin: totalOvertimeMin,
                    daysPaid: rows.reduce((s, r) => s + r.payroll.daysPaid, 0)
                }}
            />

            <div className="mt-4 text-xs text-gray-500 dark:text-zinc-400 space-y-1 max-w-3xl">
                <p className="font-bold text-gray-600 dark:text-zinc-300">Cómo se calcula</p>
                <p>
                    Horas pagadas: de la entrada a la salida, menos el almuerzo. El break
                    se paga hasta el máximo del horario; lo que se pase, no.
                </p>
                <p>
                    Horas extra: lo que pase de la jornada del horario (salida − entrada −
                    almuerzo) y todo lo trabajado en un día libre, pagado a 1,5× el
                    salario por hora.
                </p>
                <p>
                    Un día sin marcar la salida no se paga hasta corregirlo. Es el salario
                    bruto: no incluye rebajos de CCSS ni renta, feriados, vacaciones ni
                    aguinaldo.
                </p>
            </div>
        </div>
    );
}
