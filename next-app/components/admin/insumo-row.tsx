'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, Check, CheckCircle2, Loader2, Send, X } from 'lucide-react';
import {
    reportMissingInsumoAction,
    toggleInsumoCompleteAction
} from '@/app/(admin)/admin/operador/actions';

interface Insumo {
    name: string;
    totalQty: number;
}

interface Props {
    ins: Insumo;
    orderUuid: string | undefined;
    isCompleted: boolean;
    onToggleComplete: (completed: boolean) => void;
    /** Board raising the report — recorded so the receive step can be
     * surfaced back on the right board. */
    stage?: string;
}

/**
 * Renders a single insumo row with the qty, a check button (toggle
 * completion via `insumo_completions`), and a warning button that
 * opens an inline "report missing" form (writes to
 * `missing_insumo_reports`). Shared by the operator and maquila boards
 * so both stages can act on the same insumo state.
 */
export function InsumoRow({ ins, orderUuid, isCompleted, onToggleComplete, stage }: Props) {
    const [reporting, setReporting] = useState(false);
    const [sent, setSent] = useState(false);

    return (
        <div>
            <div
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    isCompleted
                        ? 'bg-green-50 dark:bg-green-950/30'
                        : 'bg-purple-50 dark:bg-purple-950/30'
                }`}
            >
                <span
                    className={`truncate ${
                        isCompleted
                            ? 'text-green-800 dark:text-green-300 line-through'
                            : 'text-purple-900 dark:text-purple-200'
                    }`}
                >
                    {ins.name}
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span
                        className={`font-bold ${
                            isCompleted
                                ? 'text-green-700 dark:text-green-300'
                                : 'text-purple-700 dark:text-purple-300'
                        }`}
                    >
                        {ins.totalQty}
                    </span>
                    {orderUuid && (
                        <button
                            onClick={() => onToggleComplete(!isCompleted)}
                            className={`rounded-full p-1 transition-colors ${
                                isCompleted
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:border-green-500 hover:text-green-600'
                            }`}
                            title={isCompleted ? 'Marcar como pendiente' : 'Marcar como completo'}
                        >
                            <Check size={12} strokeWidth={3} />
                        </button>
                    )}
                    {sent ? (
                        <span className="text-red-500 dark:text-red-400" title="Faltante reportado">
                            <CheckCircle2 size={14} />
                        </span>
                    ) : (
                        <button
                            onClick={() => setReporting((r) => !r)}
                            className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300 transition-colors"
                            title="Reportar faltante"
                        >
                            <AlertTriangle size={14} />
                        </button>
                    )}
                </div>
            </div>
            {reporting && orderUuid && (
                <ReportMissingForm
                    orderId={orderUuid}
                    insumoName={ins.name}
                    requiredQty={ins.totalQty}
                    stage={stage}
                    onClose={() => setReporting(false)}
                    onSent={() => {
                        setReporting(false);
                        setSent(true);
                    }}
                />
            )}
        </div>
    );
}

function ReportMissingForm({
    orderId,
    insumoName,
    requiredQty,
    stage,
    onClose,
    onSent
}: {
    orderId: string;
    insumoName: string;
    requiredQty: number;
    stage?: string;
    onClose: () => void;
    onSent: () => void;
}) {
    const [missingQty, setMissingQty] = useState<string>(String(requiredQty));
    const [notes, setNotes] = useState('');
    const [sending, startSending] = useTransition();

    const handleSubmit = () => {
        const qty = parseFloat(missingQty);
        if (!qty || qty <= 0) return;
        startSending(async () => {
            try {
                await reportMissingInsumoAction(
                    orderId,
                    insumoName,
                    requiredQty,
                    qty,
                    notes || undefined,
                    stage
                );
                onSent();
            } catch {
                alert('Error al reportar faltante');
            }
        });
    };

    return (
        <div className="mt-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-red-700 dark:text-red-300">
                    Reportar faltante: {insumoName}
                </p>
                <button onClick={onClose} className="text-red-400 hover:text-red-600">
                    <X size={14} />
                </button>
            </div>
            <div className="flex gap-2">
                <div className="flex-1">
                    <label className="text-xs text-red-600 dark:text-red-400">Cant. faltante</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={missingQty}
                        onChange={(e) => setMissingQty(e.target.value)}
                        className="w-full px-2 py-1.5 border border-red-200 dark:border-red-800 rounded text-sm bg-white dark:bg-zinc-900 outline-none focus:ring-1 focus:ring-red-400"
                    />
                </div>
                <div className="flex-1">
                    <label className="text-xs text-red-600 dark:text-red-400">Nota (opcional)</label>
                    <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Detalle..."
                        className="w-full px-2 py-1.5 border border-red-200 dark:border-red-800 rounded text-sm bg-white dark:bg-zinc-900 outline-none focus:ring-1 focus:ring-red-400"
                    />
                </div>
            </div>
            <button
                onClick={handleSubmit}
                disabled={sending || !parseFloat(missingQty)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
                {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Enviar reporte
            </button>
        </div>
    );
}

/** Stable string key for membership in a Set of completed (order, insumo). */
export const completionKey = (orderId: string, insumoName: string) =>
    `${orderId}|${insumoName}`;

/** Shared client-side completion toggle: optimistic update + rollback on error. */
export function useToggleInsumoCompletion(
    setCompleted: React.Dispatch<React.SetStateAction<Set<string>>>
) {
    const [, startTransition] = useTransition();
    return (orderId: string, insumoName: string, completed: boolean) => {
        const key = completionKey(orderId, insumoName);
        setCompleted((prev) => {
            const next = new Set(prev);
            if (completed) next.add(key);
            else next.delete(key);
            return next;
        });
        startTransition(async () => {
            try {
                await toggleInsumoCompleteAction(orderId, insumoName, completed);
            } catch {
                alert('Error al actualizar insumo');
                setCompleted((prev) => {
                    const rollback = new Set(prev);
                    if (completed) rollback.delete(key);
                    else rollback.add(key);
                    return rollback;
                });
            }
        });
    };
}
