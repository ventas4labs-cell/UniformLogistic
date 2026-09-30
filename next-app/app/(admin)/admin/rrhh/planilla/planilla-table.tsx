'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Pencil } from 'lucide-react';
import { fmtHm } from '@/lib/services/hr-attendance';
import { crHHMM, crWeekday } from '@/lib/services/hr-punches';
import { WEEKDAY_LABELS } from '@/lib/services/hr-schedules';
import { KIND_LABELS } from '@/lib/services/hr-time-off';
import {
    fmtColones,
    fmtDate,
    fmtRate,
    type EmployeePayroll,
    type PayDay
} from '@/lib/services/hr-payroll';

export interface PlanillaRow {
    employeeId: string;
    fullName: string;
    position: string;
    isActive: boolean;
    payroll: EmployeePayroll;
}

// "38,75 h" — decimal hours make "horas × tarifa" checkable by hand.
const fmtHours = (min: number) =>
    `${new Intl.NumberFormat('es-CR', { maximumFractionDigits: 2 }).format(min / 60)} h`;

const TAG = 'px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap';
const TAG_RED = `${TAG} bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300`;
const TAG_AMBER = `${TAG} bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300`;
const TAG_SKY = `${TAG} bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300`;
const TAG_GREEN = `${TAG} bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300`;
const TAG_GRAY = `${TAG} bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400`;

const TH = 'px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase';
const SUB_TH = 'px-3 py-2 font-semibold text-gray-500 dark:text-zinc-400 text-[11px] uppercase';

export function PlanillaTable({
    rows,
    totals
}: {
    rows: PlanillaRow[];
    totals: { grossPay: number; regularMin: number; overtimeMin: number; daysPaid: number };
}) {
    const [open, setOpen] = useState<Set<string>>(new Set());
    const toggle = (id: string) =>
        setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    if (rows.length === 0) {
        return (
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-12 text-center text-gray-500 dark:text-zinc-400">
                No hay empleados activos ni marcajes en este periodo.
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-x-auto border border-gray-200 dark:border-zinc-800">
            <table className="w-full text-sm min-w-[820px]">
                <thead className="bg-gray-50 dark:bg-zinc-900/60">
                    <tr>
                        <th className={`${TH} text-left`}>Empleado</th>
                        <th className={`${TH} text-right`}>Salario / hora</th>
                        <th className={`${TH} text-right`}>Días</th>
                        <th className={`${TH} text-right`}>Ordinarias</th>
                        <th className={`${TH} text-right`}>Extra</th>
                        <th className={`${TH} text-right`}>Salario bruto</th>
                        <th className="px-2 py-3 w-10"><span className="sr-only">Detalle</span></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {rows.map((r) => {
                        const p = r.payroll;
                        const expanded = open.has(r.employeeId);
                        const detailId = `planilla-${r.employeeId}`;
                        return (
                            <Fragment key={r.employeeId}>
                                <tr
                                    onClick={() => toggle(r.employeeId)}
                                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/40"
                                >
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-gray-900 dark:text-zinc-100">{r.fullName}</div>
                                        {r.position && (
                                            <div className="text-[11px] text-gray-500 dark:text-zinc-500">{r.position}</div>
                                        )}
                                        <div className="flex flex-wrap gap-1 mt-1 empty:hidden">
                                            {!r.isActive && <span className={TAG_GRAY}>Inactivo</span>}
                                            {p.incompleteDates.length > 0 && (
                                                <span className={TAG_RED}>
                                                    {p.incompleteDates.length} sin marca completa
                                                </span>
                                            )}
                                            {p.openToday && <span className={TAG_GREEN}>En curso</span>}
                                            {p.leaveDays > 0 && (
                                                <span className={TAG_SKY}>
                                                    {p.leaveDays} {p.leaveDays === 1 ? 'día' : 'días'} de permiso
                                                </span>
                                            )}
                                            {p.invalidSchedule ? (
                                                <span className={TAG_AMBER} title="La salida del horario no es posterior a la entrada más el almuerzo; se usa una jornada de 8 h.">
                                                    Revisar horario
                                                </span>
                                            ) : (
                                                p.usesDefaultSchedule && (
                                                    <span className={TAG_GRAY} title="Sin horario guardado: jornada de 8:00 a 17:00, lunes a viernes.">
                                                        Horario por defecto
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300 whitespace-nowrap">
                                        {p.rates.length > 0 ? (
                                            p.rates.map(fmtRate).join(' → ')
                                        ) : p.grossPay == null ? (
                                            <span className={TAG_AMBER}>Sin definir</span>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">{p.daysPaid}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        <div className="font-semibold text-gray-900 dark:text-zinc-100">{fmtHm(p.regularMin)}</div>
                                        <div className="text-[11px] text-gray-500 dark:text-zinc-500">{fmtHours(p.regularMin)}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {p.overtimeMin > 0 ? (
                                            <>
                                                <div className="font-semibold text-gray-900 dark:text-zinc-100">{fmtHm(p.overtimeMin)}</div>
                                                <div className="text-[11px] text-gray-500 dark:text-zinc-500">{fmtHours(p.overtimeMin)}</div>
                                            </>
                                        ) : (
                                            <span className="text-gray-400 dark:text-zinc-600">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900 dark:text-zinc-100 whitespace-nowrap">
                                        {p.grossPay == null ? (
                                            <span className="font-normal text-gray-400 dark:text-zinc-600">—</span>
                                        ) : (
                                            fmtColones(p.grossPay)
                                        )}
                                    </td>
                                    <td className="px-2 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={(ev) => {
                                                ev.stopPropagation();
                                                toggle(r.employeeId);
                                            }}
                                            aria-expanded={expanded}
                                            aria-controls={detailId}
                                            aria-label={`${expanded ? 'Ocultar' : 'Ver'} detalle por día de ${r.fullName}`}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                        >
                                            <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                        </button>
                                    </td>
                                </tr>
                                {expanded && (
                                    <tr id={detailId} className="bg-gray-50/70 dark:bg-zinc-950/40">
                                        <td colSpan={7} className="px-4 py-3">
                                            <DayBreakdown employeeId={r.employeeId} days={p.days} />
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 dark:border-zinc-700">
                    <tr>
                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-zinc-100">Total</td>
                        <td />
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-700 dark:text-zinc-300">{totals.daysPaid}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-zinc-100">{fmtHm(totals.regularMin)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-zinc-100">{fmtHm(totals.overtimeMin)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-extrabold text-gray-900 dark:text-zinc-100 whitespace-nowrap">{fmtColones(totals.grossPay)}</td>
                        <td />
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

function DayBreakdown({ employeeId, days }: { employeeId: string; days: PayDay[] }) {
    if (days.length === 0) {
        return (
            <p className="text-sm text-gray-500 dark:text-zinc-400 py-2">
                Sin marcajes en este periodo.
            </p>
        );
    }
    // Fixed widths so every expanded employee lines up the same way.
    return (
        <table className="w-full text-xs table-fixed">
            <colgroup>
                <col className="w-[13%]" />
                <col className="w-[15%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[18%]" />
            </colgroup>
            <thead>
                <tr>
                    <th className={`${SUB_TH} text-left`}>Día</th>
                    <th className={`${SUB_TH} text-left`}>Marcas</th>
                    <th className={`${SUB_TH} text-right`}>Pagado</th>
                    <th className={`${SUB_TH} text-right`}>Ordinarias</th>
                    <th className={`${SUB_TH} text-right`}>Extra</th>
                    <th className={`${SUB_TH} text-right`}>Tarifa</th>
                    <th className={`${SUB_TH} text-right`}>Monto</th>
                    <th className={`${SUB_TH} text-left`}>Nota</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/70 dark:divide-zinc-800">
                {days.map((d) => {
                    const paid = d.status === 'paid';
                    return (
                        <tr key={d.date} className={paid ? '' : 'text-gray-500 dark:text-zinc-500'}>
                            <td className="px-3 py-2 whitespace-nowrap font-semibold text-gray-800 dark:text-zinc-200">
                                {WEEKDAY_LABELS[crWeekday(d.date)]} {fmtDate(d.date, false)}
                            </td>
                            <td className="px-3 py-2 font-mono whitespace-nowrap text-gray-700 dark:text-zinc-300">
                                {d.firstIn || d.lastOut
                                    ? `${d.firstIn ? crHHMM(d.firstIn) : '—'} – ${d.lastOut ? crHHMM(d.lastOut) : '—'}`
                                    : ''}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                                {paid && (
                                    <>
                                        <div className="font-semibold text-gray-900 dark:text-zinc-100">
                                            {fmtHm(d.workedMin + d.paidBreakMin)}
                                        </div>
                                        {d.paidBreakMin > 0 && (
                                            <div className="text-[10px] text-gray-500 dark:text-zinc-500">
                                                incl. {d.paidBreakMin} min de break
                                            </div>
                                        )}
                                    </>
                                )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                                {paid ? fmtHm(d.regularMin) : ''}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                                {paid && d.overtimeMin > 0 ? fmtHm(d.overtimeMin) : paid ? '—' : ''}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-zinc-300 whitespace-nowrap">
                                {paid && d.hourlyRate != null ? fmtRate(d.hourlyRate) : ''}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-zinc-100 whitespace-nowrap">
                                {paid && d.hourlyRate != null ? fmtColones(d.regularPay + d.overtimePay) : ''}
                            </td>
                            <td className="px-3 py-2">
                                <div className="flex flex-wrap items-center gap-1">
                                    {d.status === 'incomplete' && (
                                        <>
                                            <span className={TAG_RED}>{d.firstIn ? 'Sin salida' : 'Sin entrada'}</span>
                                            <Link
                                                href={`/admin/rrhh/asistencia/${employeeId}?d=${d.date}`}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/60 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/40 whitespace-nowrap"
                                            >
                                                <Pencil size={10} /> Corregir
                                            </Link>
                                        </>
                                    )}
                                    {d.status === 'open' && <span className={TAG_GREEN}>En curso</span>}
                                    {d.dayOff && paid && <span className={TAG_AMBER}>Día libre: todo extra</span>}
                                    {d.leaveKind && <span className={TAG_SKY}>{KIND_LABELS[d.leaveKind]}</span>}
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
