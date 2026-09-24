'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, X } from 'lucide-react';
import {
    daysInRange,
    KIND_LABELS,
    STATUS_LABELS,
    STATUS_STYLE,
    type TimeOffRequest
} from '@/lib/services/hr-time-off';
import { reviewTimeOffAction } from '../actions';

const fmtDay = (dateStr: string) =>
    new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('es-CR', {
        timeZone: 'America/Costa_Rica',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

const fmtRange = (start: string, end: string) =>
    start === end ? fmtDay(start) : `${fmtDay(start)} – ${fmtDay(end)}`;

const dayCount = (start: string, end: string) => {
    const n = daysInRange(start, end);
    return `${n} ${n === 1 ? 'día' : 'días'}`;
};

export function TimeOffReview({
    requests,
    names
}: {
    requests: TimeOffRequest[];
    names: Record<string, string>;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});

    const open = requests
        .filter((r) => r.status === 'pending')
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const decided = requests.filter((r) => r.status !== 'pending');

    const decide = (r: TimeOffRequest, decision: 'approved' | 'rejected') => {
        setBusyId(r.id);
        startTransition(async () => {
            setError(null);
            const res = await reviewTimeOffAction(r.id, decision, notes[r.id] || '');
            setBusyId(null);
            if (res.error) setError(res.error);
            else router.refresh();
        });
    };

    return (
        <div className="space-y-8">
            {error && (
                <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">
                    {error}
                </div>
            )}

            <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-3">
                    Pendientes ({open.length})
                </h3>
                {open.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                        No hay solicitudes pendientes.
                    </div>
                ) : (
                    <ul className="grid gap-3 md:grid-cols-2">
                        {open.map((r) => (
                            <li
                                key={r.id}
                                className="bg-white dark:bg-zinc-900 rounded-xl border border-amber-200 dark:border-amber-900/50 p-4 flex flex-col gap-3"
                            >
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-zinc-100">
                                        {names[r.employeeId] || 'Empleado eliminado'}
                                    </p>
                                    <p className="text-sm text-gray-700 dark:text-zinc-300">
                                        <span className="font-semibold">{KIND_LABELS[r.kind]}</span>
                                        {' · '}
                                        <span className="capitalize">{fmtRange(r.startDate, r.endDate)}</span>
                                        <span className="text-gray-400 dark:text-zinc-500"> · {dayCount(r.startDate, r.endDate)}</span>
                                    </p>
                                    {r.reason && (
                                        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400 break-words">“{r.reason}”</p>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={notes[r.id] || ''}
                                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                                    maxLength={500}
                                    placeholder="Nota para el empleado (opcional)"
                                    aria-label="Nota para el empleado"
                                    className="w-full p-2 text-sm border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => decide(r, 'approved')}
                                        disabled={pending}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                                    >
                                        {busyId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                        Aprobar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => decide(r, 'rejected')}
                                        disabled={pending}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 dark:border-red-900/60 text-red-700 dark:text-red-300 text-sm font-bold hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                                    >
                                        <X size={14} /> Rechazar
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-3">
                    Historial
                </h3>
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-x-auto border border-gray-200 dark:border-zinc-800">
                    {decided.length === 0 ? (
                        <div className="p-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                            Todavía no hay solicitudes revisadas.
                        </div>
                    ) : (
                        <table className="w-full text-sm min-w-[720px]">
                            <thead className="bg-gray-50 dark:bg-zinc-900/60">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Empleado</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Tipo</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Fechas</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Estado</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Nota</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {decided.map((r) => (
                                    <tr key={r.id}>
                                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-zinc-100">{names[r.employeeId] || 'Empleado eliminado'}</td>
                                        <td className="px-4 py-3 text-gray-700 dark:text-zinc-300">{KIND_LABELS[r.kind]}</td>
                                        <td className="px-4 py-3 text-gray-700 dark:text-zinc-300">
                                            <span className="capitalize">{fmtRange(r.startDate, r.endDate)}</span>
                                            <span className="text-gray-400 dark:text-zinc-500"> · {dayCount(r.startDate, r.endDate)}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_STYLE[r.status]}`}>
                                                {STATUS_LABELS[r.status]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-400 max-w-[280px] break-words">
                                            {r.adminNote || r.reason || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>
        </div>
    );
}
