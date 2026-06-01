'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import {
    markStageCompleteAction,
    unmarkStageCompleteAction
} from '@/app/(admin)/admin/_stage-actions';
import {
    STAGE_LABELS,
    type StageKey
} from '@/lib/services/stage-completions';

interface Props {
    orderUuid: string | undefined;
    stage: StageKey;
    isCompleted: boolean;
    // Optional ISO string — exposed in the title attribute so admin
    // can read the completion timestamp on hover.
    completedAt?: string | null;
    // Optional human-readable identifier (e.g. "ORDEN-00006") shown in
    // the confirm modal so operator knows which order they're acting on.
    orderRef?: string;
    // Local-state mutator so the parent board can optimistically flip
    // the completion before the action round-trips.
    onLocalChange: (orderUuid: string, next: boolean) => void;
}

// Single round icon-only toggle. Pending = outlined orange circle.
// Completed = filled green circle with a check. Marking complete
// requires a confirmation modal; undoing (completed → pending) flips
// instantly because it's a recovery action.
export function StageCompleteToggle({
    orderUuid,
    stage,
    isCompleted,
    completedAt,
    orderRef,
    onLocalChange
}: Props) {
    const [pending, startTransition] = useTransition();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const disabled = !orderUuid || pending;
    const stageLabel = STAGE_LABELS[stage];

    const tooltip = (() => {
        if (isCompleted) {
            const when = completedAt ? new Date(completedAt) : null;
            const whenLabel = when
                ? `${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : '';
            return whenLabel
                ? `${stageLabel} completado · ${whenLabel} · Clic para deshacer`
                : `${stageLabel} completado · Clic para deshacer`;
        }
        return `Marcar ${stageLabel.toLowerCase()} completo`;
    })();

    const runToggle = (next: boolean) => {
        if (!orderUuid) return;
        onLocalChange(orderUuid, next);
        startTransition(async () => {
            try {
                if (next) await markStageCompleteAction(orderUuid, stage);
                else await unmarkStageCompleteAction(orderUuid, stage);
            } catch {
                alert('No se pudo actualizar la etapa. Recargá.');
                onLocalChange(orderUuid, !next);
            }
        });
    };

    const handleClick = () => {
        if (!orderUuid) return;
        if (isCompleted) {
            // Recovery direction: no confirmation needed.
            runToggle(false);
            return;
        }
        setConfirmOpen(true);
    };

    return (
        <>
            <button
                type="button"
                onClick={handleClick}
                disabled={disabled}
                title={tooltip}
                aria-label={tooltip}
                aria-pressed={isCompleted}
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                    isCompleted
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-white dark:bg-zinc-900 border-2 border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40'
                }`}
            >
                {pending ? (
                    <Loader2 size={16} className="animate-spin" />
                ) : (
                    <Check size={16} strokeWidth={3} />
                )}
            </button>

            {confirmOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setConfirmOpen(false)}
                >
                    <div
                        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-2">
                            ¿Marcar {stageLabel.toLowerCase()} completo?
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-zinc-400">
                            {orderRef ? (
                                <>
                                    Vas a marcar la etapa{' '}
                                    <span className="font-semibold">{stageLabel}</span> como
                                    completada para{' '}
                                    <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                                        {orderRef}
                                    </span>
                                    .
                                </>
                            ) : (
                                <>
                                    Vas a marcar la etapa{' '}
                                    <span className="font-semibold">{stageLabel}</span> como
                                    completada para este pedido.
                                </>
                            )}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-500 mt-2 italic">
                            Podés deshacerlo después tocando el mismo botón.
                        </p>
                        <div className="flex gap-3 mt-5">
                            <button
                                type="button"
                                onClick={() => setConfirmOpen(false)}
                                className="flex-1 py-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setConfirmOpen(false);
                                    runToggle(true);
                                }}
                                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 text-sm flex items-center justify-center gap-1.5"
                            >
                                <Check size={14} strokeWidth={3} />
                                Sí, marcar completo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
