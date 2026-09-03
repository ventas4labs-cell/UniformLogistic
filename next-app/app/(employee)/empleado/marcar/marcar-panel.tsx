'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Check, Loader2, LogIn, LogOut, Coffee, Utensils } from 'lucide-react';
import {
    PUNCH_LABELS,
    STATE_LABELS,
    type Punch,
    type PunchAction,
    type PunchState,
    type PunchType
} from '@/lib/services/hr-punches';
import { recordPunchAction } from './actions';

export type TokenStatus = 'ok' | 'missing' | 'invalid' | 'expired' | 'used';

const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-CR', {
        timeZone: 'America/Costa_Rica',
        hour: '2-digit',
        minute: '2-digit'
    });

const ACTION_ICON: Record<PunchType, typeof LogIn> = {
    in: LogIn,
    out: LogOut,
    break_start: Coffee,
    break_end: Coffee,
    lunch_start: Utensils,
    lunch_end: Utensils
};

const STATE_STYLE: Record<PunchState, string> = {
    working: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300',
    on_break: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    on_lunch: 'bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300',
    out: 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300'
};

export function MarcarPanel({
    token,
    tokenStatus,
    initialState,
    initialActions,
    initialPunches,
    employeeName
}: {
    token: string;
    tokenStatus: TokenStatus;
    initialState: PunchState;
    initialActions: PunchAction[];
    initialPunches: Punch[];
    employeeName: string;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
    // A code is good for one punch, so once this one lands the buttons go
    // away and the employee is told to scan again for the next marcaje.
    const [spent, setSpent] = useState(false);

    const onPunch = (type: PunchType) =>
        startTransition(async () => {
            setResult(null);
            const res = await recordPunchAction(token, type);
            if (res.error) {
                setResult({ ok: false, text: res.error });
                return;
            }
            const time = res.punchedAt ? ` · ${fmtTime(res.punchedAt)}` : '';
            setResult({ ok: true, text: `${res.message}${time}` });
            setSpent(true);
            router.refresh();
        });

    const tokenOk = tokenStatus === 'ok' && !spent;
    const firstName = employeeName.split(' ')[0] || '';

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                    {firstName ? `Hola, ${firstName}` : 'Marcar'}
                </h1>
                <div className="mt-2 inline-flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-zinc-400">Estado:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATE_STYLE[initialState]}`}>
                        {STATE_LABELS[initialState]}
                    </span>
                </div>
            </div>

            {result && (
                <div
                    className={`flex items-center gap-2 p-3 rounded-xl text-sm font-semibold border ${
                        result.ok
                            ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/50'
                            : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50'
                    }`}
                >
                    {result.ok ? <Check size={18} /> : <AlertTriangle size={18} />}
                    {result.text}
                </div>
            )}

            {tokenOk ? (
                <div className="grid grid-cols-1 gap-3">
                    {initialActions.map((a) => {
                        const Icon = ACTION_ICON[a.type];
                        const primary = a.type === 'in' || a.type === 'out';
                        return (
                            <button
                                key={a.type}
                                type="button"
                                onClick={() => onPunch(a.type)}
                                disabled={pending}
                                className={`flex items-center justify-center gap-3 py-4 rounded-2xl text-lg font-bold shadow-sm disabled:opacity-50 transition-colors ${
                                    primary
                                        ? 'bg-orange-600 text-white hover:bg-orange-700'
                                        : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                }`}
                            >
                                {pending ? (
                                    <Loader2 size={20} className="animate-spin" />
                                ) : (
                                    <Icon size={20} />
                                )}
                                {a.label}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4 text-center">
                    <AlertTriangle size={22} className="mx-auto text-amber-600 dark:text-amber-400" />
                    <p className="mt-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                        {spent
                            ? 'Marcaje guardado. Para el siguiente, escaneá otra vez el código de la pantalla.'
                            : tokenStatus === 'expired'
                              ? 'El código venció. Escaneá de nuevo el QR del taller.'
                              : tokenStatus === 'used'
                                ? 'Ya usaste este código. Escaneá el código nuevo de la pantalla para volver a marcar.'
                                : 'Escaneá el código QR del taller para poder marcar.'}
                    </p>
                    <Link
                        href="/empleado"
                        className="inline-block mt-3 text-sm font-bold text-orange-700 dark:text-orange-400 hover:underline"
                    >
                        Volver
                    </Link>
                </div>
            )}

            <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">
                    Marcajes de hoy
                </p>
                {initialPunches.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-zinc-500">
                        Todavía no marcaste nada hoy.
                    </p>
                ) : (
                    <ul className="space-y-1.5">
                        {initialPunches.map((p) => (
                            <li
                                key={p.id}
                                className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm"
                            >
                                <span className="text-gray-900 dark:text-zinc-100">
                                    {PUNCH_LABELS[p.punchType]}
                                </span>
                                <span className="font-mono text-gray-500 dark:text-zinc-400">
                                    {fmtTime(p.punchedAt)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
