'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import {
    crHHMM,
    PUNCH_LABELS,
    PUNCH_TYPES,
    type Punch,
    type PunchType
} from '@/lib/services/hr-punches';
import { correctPunchAction } from '../../actions';

type Mode =
    | { kind: 'edit'; id: string }
    | { kind: 'delete'; id: string }
    | { kind: 'add' }
    | null;

const inputCls =
    'p-2 text-sm border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent';

export function PunchEditor({
    employeeId,
    date,
    punches,
    issueIds,
    suggestedType
}: {
    employeeId: string;
    date: string;
    punches: Punch[];
    /** Punches that break the in/out sequence — highlighted. */
    issueIds: string[];
    /** Most likely missing punch (what the day expects next). */
    suggestedType: PunchType;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [mode, setMode] = useState<Mode>(null);
    const [punchType, setPunchType] = useState<PunchType>(suggestedType);
    const [time, setTime] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);

    const open = (next: Mode, p?: Punch) => {
        setError(null);
        setReason('');
        setMode(next);
        if (p) {
            setPunchType(p.punchType);
            setTime(crHHMM(p.punchedAt));
        } else {
            setPunchType(suggestedType);
            setTime('');
        }
    };

    const submit = (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!mode) return;
        startTransition(async () => {
            setError(null);
            const res = await correctPunchAction({
                action: mode.kind === 'add' ? 'create' : mode.kind === 'edit' ? 'update' : 'delete',
                employeeId,
                date,
                punchId: mode.kind === 'add' ? undefined : mode.id,
                punchType,
                time,
                reason
            });
            if (res.error) {
                setError(res.error);
                return;
            }
            setMode(null);
            router.refresh();
        });
    };

    const reasonField = (
        <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            required
            placeholder="Motivo (obligatorio) — ej.: olvidó marcar salida"
            aria-label="Motivo de la corrección"
            className={`${inputCls} w-full`}
        />
    );

    const typeTimeFields = (
        <div className="flex flex-wrap gap-2">
            <select
                value={punchType}
                onChange={(e) => setPunchType(e.target.value as PunchType)}
                aria-label="Tipo de marcaje"
                className={`${inputCls} flex-1 min-w-[160px]`}
            >
                {PUNCH_TYPES.map((t) => (
                    <option key={t} value={t}>
                        {PUNCH_LABELS[t]}
                    </option>
                ))}
            </select>
            <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                aria-label="Hora"
                className={`${inputCls} w-32 font-mono`}
            />
        </div>
    );

    const actions = (label: string, danger = false) => (
        <div className="flex justify-end gap-2">
            <button
                type="button"
                onClick={() => setMode(null)}
                className="px-3 py-1.5 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
            >
                Cancelar
            </button>
            <button
                type="submit"
                disabled={pending}
                className={`px-3 py-1.5 text-sm font-bold text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5 ${
                    danger ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
                }`}
            >
                {pending && <Loader2 size={14} className="animate-spin" />}
                {label}
            </button>
        </div>
    );

    const errorBox = error && (
        <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-2.5 rounded-lg text-sm border border-red-200 dark:border-red-900/50">
            {error}
        </div>
    );

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                    Marcajes ({punches.length})
                </h3>
                {mode?.kind !== 'add' && (
                    <button
                        type="button"
                        onClick={() => open({ kind: 'add' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-800 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/40"
                    >
                        <Plus size={14} /> Agregar marcaje
                    </button>
                )}
            </div>

            {mode?.kind === 'add' && (
                <form onSubmit={submit} className="p-4 space-y-2.5 bg-orange-50/50 dark:bg-orange-950/10 border-b border-gray-100 dark:border-zinc-800">
                    <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">Nuevo marcaje</p>
                    {typeTimeFields}
                    {reasonField}
                    {errorBox}
                    {actions('Agregar')}
                </form>
            )}

            {punches.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                    No hay marcajes este día.
                </p>
            ) : (
                <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {punches.map((p) => {
                        const bad = issueIds.includes(p.id);
                        const editing = mode?.kind === 'edit' && mode.id === p.id;
                        const deleting = mode?.kind === 'delete' && mode.id === p.id;
                        return (
                            <li key={p.id} className={bad ? 'bg-red-50/60 dark:bg-red-950/20' : ''}>
                                <div className="flex items-center gap-3 px-4 py-2.5">
                                    <span className="font-mono text-sm text-gray-900 dark:text-zinc-100 w-12">
                                        {crHHMM(p.punchedAt)}
                                    </span>
                                    <span className="flex-1 min-w-0 text-sm text-gray-800 dark:text-zinc-200 flex items-center gap-2 flex-wrap">
                                        {PUNCH_LABELS[p.punchType]}
                                        {p.source === 'admin' ? (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300">
                                                Ajustado
                                            </span>
                                        ) : (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400">
                                                QR
                                            </span>
                                        )}
                                        {bad && (
                                            <AlertTriangle size={14} className="text-red-600 dark:text-red-400" aria-label="Fuera de secuencia" />
                                        )}
                                    </span>
                                    {!editing && !deleting && (
                                        <span className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => open({ kind: 'edit', id: p.id }, p)}
                                                title="Corregir"
                                                aria-label={`Corregir ${PUNCH_LABELS[p.punchType]} de las ${crHHMM(p.punchedAt)}`}
                                                className="p-1.5 text-gray-500 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                                            >
                                                <Pencil size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => open({ kind: 'delete', id: p.id }, p)}
                                                title="Eliminar"
                                                aria-label={`Eliminar ${PUNCH_LABELS[p.punchType]} de las ${crHHMM(p.punchedAt)}`}
                                                className="p-1.5 text-gray-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </span>
                                    )}
                                </div>
                                {editing && (
                                    <form onSubmit={submit} className="px-4 pb-3 space-y-2.5">
                                        {typeTimeFields}
                                        {reasonField}
                                        {errorBox}
                                        {actions('Guardar cambio')}
                                    </form>
                                )}
                                {deleting && (
                                    <form onSubmit={submit} className="px-4 pb-3 space-y-2.5">
                                        <p className="text-sm text-red-700 dark:text-red-300">
                                            Se eliminará este marcaje. Queda registrado en el historial.
                                        </p>
                                        {reasonField}
                                        {errorBox}
                                        {actions('Eliminar marcaje', true)}
                                    </form>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
