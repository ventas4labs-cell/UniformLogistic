'use client';

import { Check } from 'lucide-react';
import {
    STAGE_LABELS,
    STAGE_ORDER,
    type StageKey
} from '@/lib/services/stage-completions';

interface Props {
    // Set of stages that have been completed for this order. Pass a
    // Set<StageKey> from the page's fetchStageCompletionsForOrders
    // result, or `new Set()` if the order has none yet.
    completed: Set<StageKey>;
    // Stages the order's products actually need. Only these render and
    // count toward "Listo". Defaults to every stage.
    applicableStages?: StageKey[];
    // Compact mode renders smaller pills (used in the Pedidos card grid
    // where space is tight). Default is the regular size used on the
    // stage board headers.
    compact?: boolean;
}

// Read-only visual: shows which ops stages are done for one order. The
// strip is rendered everywhere we want to summarize stage progress —
// Pedidos cards, board headers, order detail dialogs.
export function StageCompletionStrip({
    completed,
    applicableStages,
    compact = false
}: Props) {
    const stages =
        applicableStages && applicableStages.length > 0
            ? STAGE_ORDER.filter((s) => applicableStages.includes(s))
            : STAGE_ORDER;
    const total = stages.length;
    const done = stages.filter((s) => completed.has(s)).length;
    const allDone = total > 0 && done === total;

    return (
        <div
            className="flex flex-wrap items-center gap-1.5"
            aria-label={`Etapas completadas: ${done} de ${total}`}
        >
            {stages.map((stage) => {
                const isDone = completed.has(stage);
                return (
                    <span
                        key={stage}
                        title={`${STAGE_LABELS[stage]}: ${isDone ? 'Completado' : 'Pendiente'}`}
                        className={`inline-flex items-center gap-1 rounded-full font-bold transition-colors ${
                            compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
                        } ${
                            isDone
                                ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300'
                                : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500'
                        }`}
                    >
                        {isDone ? (
                            <Check size={compact ? 10 : 12} strokeWidth={3} />
                        ) : (
                            <span className={`inline-block rounded-full bg-current opacity-40 ${compact ? 'w-1.5 h-1.5' : 'w-2 h-2'}`} />
                        )}
                        {STAGE_LABELS[stage]}
                    </span>
                );
            })}
            {allDone && (
                <span
                    className={`inline-flex items-center gap-1 rounded-full bg-green-600 text-white font-extrabold ${
                        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
                    }`}
                    title="Todas las etapas completadas"
                >
                    <Check size={compact ? 10 : 12} strokeWidth={3} />
                    Listo
                </span>
            )}
        </div>
    );
}
