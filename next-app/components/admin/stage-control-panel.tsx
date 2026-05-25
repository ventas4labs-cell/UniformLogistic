'use client';

import { useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import {
    markStageCompleteAction,
    unmarkStageCompleteAction
} from '@/app/(admin)/admin/_stage-actions';
import {
    STAGE_LABELS,
    STAGE_ORDER,
    type StageKey
} from '@/lib/services/stage-completions';

interface Props {
    orderUuid: string | undefined;
    // Map of stage → ISO completedAt timestamp. Stages missing from the
    // map are treated as not-yet-completed.
    completedAt: Partial<Record<StageKey, string>>;
    // Local-state mutator so the parent Pedidos table flips the UI
    // optimistically before the server action returns.
    onLocalToggle: (
        orderUuid: string,
        stage: StageKey,
        completed: boolean,
        completedAt?: string
    ) => void;
}

// Pedidos "control center" view of a single order's per-stage progress.
// Bigger and clickable (vs. the read-only StageCompletionStrip).
// Clicking a stage cell marks it complete from the Pedidos surface —
// useful when admin needs to override a stage operator who forgot to
// click, or to roll back a premature completion.
export function StageControlPanel({ orderUuid, completedAt, onLocalToggle }: Props) {
    const done = STAGE_ORDER.filter((s) => !!completedAt[s]).length;
    const total = STAGE_ORDER.length;
    const allDone = done === total;
    const pct = Math.round((done / total) * 100);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide">
                <span className="text-gray-500 dark:text-zinc-400">Producción</span>
                <span
                    className={
                        allDone
                            ? 'text-green-700 dark:text-green-300'
                            : done === 0
                                ? 'text-gray-500 dark:text-zinc-500'
                                : 'text-orange-600 dark:text-orange-400'
                    }
                >
                    {done}/{total} etapas
                </span>
            </div>

            {/* Progress bar — quick visual scan across many cards. */}
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                <div
                    className={`h-full transition-all ${
                        allDone ? 'bg-green-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${pct}%` }}
                />
            </div>

            <div className="grid grid-cols-4 gap-1.5">
                {STAGE_ORDER.map((stage) => (
                    <StageCell
                        key={stage}
                        orderUuid={orderUuid}
                        stage={stage}
                        completedAt={completedAt[stage]}
                        onLocalToggle={onLocalToggle}
                    />
                ))}
            </div>
        </div>
    );
}

function StageCell({
    orderUuid,
    stage,
    completedAt,
    onLocalToggle
}: {
    orderUuid: string | undefined;
    stage: StageKey;
    completedAt: string | undefined;
    onLocalToggle: Props['onLocalToggle'];
}) {
    const [pending, startTransition] = useTransition();
    const isDone = !!completedAt;
    const disabled = !orderUuid || pending;

    const handleClick = () => {
        if (!orderUuid) return;
        const next = !isDone;
        const optimisticAt = next ? new Date().toISOString() : undefined;
        onLocalToggle(orderUuid, stage, next, optimisticAt);
        startTransition(async () => {
            try {
                if (next) await markStageCompleteAction(orderUuid, stage);
                else await unmarkStageCompleteAction(orderUuid, stage);
            } catch {
                // Roll back optimistic flip.
                onLocalToggle(orderUuid, stage, isDone, completedAt);
                alert('No se pudo actualizar la etapa. Recargá.');
            }
        });
    };

    const tooltip = isDone
        ? `${STAGE_LABELS[stage]} · Completado ${
              completedAt
                  ? new Date(completedAt).toLocaleDateString() +
                    ' ' +
                    new Date(completedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                  : ''
          }`
        : `${STAGE_LABELS[stage]} · Pendiente — clic para marcar completado`;

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            title={tooltip}
            className={`group relative flex flex-col items-center gap-1 px-1.5 py-2 min-w-0 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isDone
                    ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-950/60'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-orange-100 dark:hover:bg-orange-950/40 hover:text-orange-700 dark:hover:text-orange-300'
            }`}
        >
            <span
                className={`flex items-center justify-center w-5 h-5 rounded-full ${
                    isDone
                        ? 'bg-green-600 text-white'
                        : 'bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 group-hover:border-orange-500 dark:group-hover:border-orange-500'
                }`}
            >
                {pending ? (
                    <Loader2 size={11} className="animate-spin" />
                ) : isDone ? (
                    <Check size={12} strokeWidth={3} />
                ) : null}
            </span>
            <span className="uppercase tracking-wide truncate max-w-full">{STAGE_LABELS[stage]}</span>
        </button>
    );
}
