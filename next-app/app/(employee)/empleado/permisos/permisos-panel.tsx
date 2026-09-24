'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Send, X } from 'lucide-react';
import {
    daysInRange,
    KIND_LABELS,
    STATUS_LABELS,
    STATUS_STYLE,
    TIME_OFF_KINDS,
    type TimeOffKind,
    type TimeOffRequest
} from '@/lib/services/hr-time-off';
import { cancelTimeOffAction, requestTimeOffAction } from './actions';

const fmtDay = (dateStr: string) =>
    new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('es-CR', {
        timeZone: 'America/Costa_Rica',
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });

const fmtRange = (start: string, end: string) =>
    start === end ? fmtDay(start) : `${fmtDay(start)} – ${fmtDay(end)}`;

const dayCount = (start: string, end: string) => {
    const n = daysInRange(start, end);
    return `${n} ${n === 1 ? 'día' : 'días'}`;
};

const inputCls =
    'w-full p-2.5 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent';

export function PermisosPanel({
    requests,
    today,
    minDate
}: {
    requests: TimeOffRequest[];
    today: string;
    minDate: string;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [kind, setKind] = useState<TimeOffKind>('vacation');
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    const rangeOk = !!startDate && !!endDate && endDate >= startDate;

    const submit = (ev: React.FormEvent) => {
        ev.preventDefault();
        startTransition(async () => {
            setError(null);
            setSent(false);
            const res = await requestTimeOffAction({ kind, startDate, endDate, reason });
            if (res.error) {
                setError(res.error);
                return;
            }
            setSent(true);
            setReason('');
            router.refresh();
        });
    };

    const cancel = (r: TimeOffRequest) => {
        if (!confirm(`¿Cancelar la solicitud de ${KIND_LABELS[r.kind].toLowerCase()} (${fmtRange(r.startDate, r.endDate)})?`)) return;
        setCancellingId(r.id);
        startTransition(async () => {
            setError(null);
            const res = await cancelTimeOffAction(r.id);
            setCancellingId(null);
            if (res.error) setError(res.error);
            else router.refresh();
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Permisos</h1>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                    Pedí vacaciones, incapacidad o un permiso. El administrador la revisa y
                    te aparece aquí si fue aprobada.
                </p>
            </div>

            <form
                onSubmit={submit}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-5 space-y-4"
            >
                <div>
                    <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">Tipo</span>
                    <div className="grid grid-cols-2 gap-2">
                        {TIME_OFF_KINDS.map((k) => (
                            <button
                                key={k}
                                type="button"
                                onClick={() => setKind(k)}
                                aria-pressed={kind === k}
                                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${
                                    kind === k
                                        ? 'bg-orange-600 text-white border-orange-600'
                                        : 'bg-transparent text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:border-orange-400'
                                }`}
                            >
                                {KIND_LABELS[k]}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                        <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1">Desde</span>
                        <input
                            type="date"
                            value={startDate}
                            min={minDate}
                            onChange={(e) => {
                                const v = e.target.value;
                                setStartDate(v);
                                if (v && endDate < v) setEndDate(v);
                            }}
                            className={inputCls}
                            required
                        />
                    </label>
                    <label className="block">
                        <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1">Hasta</span>
                        <input
                            type="date"
                            value={endDate}
                            min={startDate || minDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className={inputCls}
                            required
                        />
                    </label>
                </div>

                <label className="block">
                    <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1">
                        Motivo <span className="normal-case font-normal">(opcional)</span>
                    </span>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={500}
                        rows={2}
                        className={`${inputCls} resize-none`}
                        placeholder="Ej.: cita médica, viaje familiar…"
                    />
                </label>

                {error && (
                    <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">
                        {error}
                    </div>
                )}
                {sent && (
                    <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 p-3 rounded-lg text-sm font-semibold border border-green-200 dark:border-green-900/50">
                        <Check size={16} /> Solicitud enviada. Queda pendiente de aprobación.
                    </div>
                )}

                <button
                    type="submit"
                    disabled={pending || !rangeOk}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 disabled:opacity-50"
                >
                    {pending && !cancellingId ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    Enviar solicitud{rangeOk ? ` · ${dayCount(startDate, endDate)}` : ''}
                </button>
            </form>

            <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">
                    Mis solicitudes
                </p>
                {requests.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-zinc-500">Todavía no pediste ningún permiso.</p>
                ) : (
                    <ul className="space-y-2">
                        {requests.map((r) => (
                            <li
                                key={r.id}
                                className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 px-4 py-3"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 dark:text-zinc-100">
                                            {KIND_LABELS[r.kind]}
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-zinc-300 capitalize">
                                            {fmtRange(r.startDate, r.endDate)}
                                            <span className="normal-case text-gray-400 dark:text-zinc-500"> · {dayCount(r.startDate, r.endDate)}</span>
                                        </p>
                                    </div>
                                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLE[r.status]}`}>
                                        {STATUS_LABELS[r.status]}
                                    </span>
                                </div>
                                {r.reason && (
                                    <p className="mt-1.5 text-sm text-gray-500 dark:text-zinc-400 break-words">{r.reason}</p>
                                )}
                                {r.adminNote && (
                                    <p className="mt-1.5 text-sm text-gray-700 dark:text-zinc-300 break-words">
                                        <span className="font-semibold">Administrador:</span> {r.adminNote}
                                    </p>
                                )}
                                {r.status === 'pending' && (
                                    <button
                                        type="button"
                                        onClick={() => cancel(r)}
                                        disabled={pending}
                                        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                                    >
                                        {cancellingId === r.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                                        Cancelar solicitud
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
