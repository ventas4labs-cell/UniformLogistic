'use client';

import { useTransition } from 'react';
import { Check, Loader2, RotateCcw } from 'lucide-react';
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
    // Optional ISO string. Shown as a relative-time hint when completed.
    completedAt?: string | null;
    // Local-state mutator so the parent board can optimistically flip
    // the completion before the action round-trips.
    onLocalChange: (orderUuid: string, next: boolean) => void;
}

export function StageCompleteToggle({
    orderUuid,
    stage,
    isCompleted,
    completedAt,
    onLocalChange
}: Props) {
    const [pending, startTransition] = useTransition();
    const disabled = !orderUuid || pending;
    const stageLabel = STAGE_LABELS[stage];

    if (isCompleted) {
        const when = completedAt ? new Date(completedAt) : null;
        const whenLabel = when
            ? when.toLocaleDateString() + ' ' + when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
        return (
            <div className="flex items-center gap-2">
                <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 text-xs font-bold"
                    title={whenLabel ? `Completado el ${whenLabel}` : 'Completado'}
                >
                    <Check size={14} strokeWidth={3} />
                    {stageLabel} completado
                </span>
                <button
                    type="button"
                    onClick={() => {
                        if (!orderUuid) return;
                        onLocalChange(orderUuid, false);
                        startTransition(async () => {
                            try {
                                await unmarkStageCompleteAction(orderUuid, stage);
                            } catch {
                                alert('No se pudo deshacer. Recargá.');
                                onLocalChange(orderUuid, true);
                            }
                        });
                    }}
                    disabled={disabled}
                    className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Deshacer completado"
                    aria-label="Deshacer completado"
                >
                    {pending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                </button>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={() => {
                if (!orderUuid) return;
                onLocalChange(orderUuid, true);
                startTransition(async () => {
                    try {
                        await markStageCompleteAction(orderUuid, stage);
                    } catch {
                        alert('No se pudo marcar completado. Recargá.');
                        onLocalChange(orderUuid, false);
                    }
                });
            }}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
            Marcar {stageLabel.toLowerCase()} completo
        </button>
    );
}
