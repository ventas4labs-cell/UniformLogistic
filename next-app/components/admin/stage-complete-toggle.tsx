'use client';

import { useTransition } from 'react';
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
    // Local-state mutator so the parent board can optimistically flip
    // the completion before the action round-trips.
    onLocalChange: (orderUuid: string, next: boolean) => void;
}

// Single round icon-only toggle. Pending = outlined orange circle.
// Completed = filled green circle with a check. Click toggles state.
// The previous "Marcar X completo" pill + separate undo button took
// up enough room to crowd the order-card header; this collapses both
// states into one ~32px button with a tooltip for context.
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

    const handleClick = () => {
        if (!orderUuid) return;
        const next = !isCompleted;
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

    return (
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
    );
}
