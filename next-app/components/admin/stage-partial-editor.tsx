'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, Loader2, Save, ImageIcon } from 'lucide-react';
import type { Order } from '@/lib/types';
import { STAGE_LABELS, type StageKey } from '@/lib/services/stage-completions';
import type { ItemProgress } from '@/lib/services/stage-item-progress';
import { saveStageProgressAction } from '@/app/(admin)/admin/_stage-actions';

// ─── Partial per-item progress editor ────────────────────────────────
// Used by stages that finish an order in batches (Bordado). Each line
// gets a "done / total" input; a progress bar sums them. Saving persists
// the counts and, when every line is full, auto-marks the whole stage
// complete (reconciled server-side). When the order is already complete
// we just show the finished summary — the header toggle handles undo.

interface Props {
    order: Order;
    stage: StageKey;
    /** Board-wide map of order_item_id → qty done for this stage. */
    initialProgress: ItemProgress;
    isCompleted: boolean;
    /** Flip the board's completion state when a save completes/uncompletes. */
    onCompletedChange: (uuid: string, next: boolean) => void;
}

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));

export function StagePartialEditor({
    order,
    stage,
    initialProgress,
    isCompleted,
    onCompletedChange
}: Props) {
    const items = order.items;
    const totalPieces = useMemo(
        () => items.reduce((s, i) => s + i.quantity, 0),
        [items]
    );

    // Seed done-counts from the persisted progress (0 when absent).
    const seed = useMemo(() => {
        const m: Record<string, number> = {};
        for (const it of items) {
            if (it.uuid) m[it.uuid] = clamp(initialProgress[it.uuid] ?? 0, it.quantity);
        }
        return m;
    }, [items, initialProgress]);

    const [saved, setSaved] = useState<Record<string, number>>(seed);
    const [draft, setDraft] = useState<Record<string, number>>(seed);
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const doneTotal = useMemo(
        () => items.reduce((s, i) => s + (i.uuid ? draft[i.uuid] ?? 0 : 0), 0),
        [items, draft]
    );
    const savedTotal = useMemo(
        () => items.reduce((s, i) => s + (i.uuid ? saved[i.uuid] ?? 0 : 0), 0),
        [items, saved]
    );
    const pct = totalPieces > 0 ? Math.round((doneTotal / totalPieces) * 100) : 0;
    const allFull = doneTotal >= totalPieces && totalPieces > 0;
    const dirty = items.some((i) => i.uuid && (draft[i.uuid] ?? 0) !== (saved[i.uuid] ?? 0));
    const canSave = !!order.uuid && dirty && !pending;

    const setLine = (id: string, value: number, max: number) => {
        setDraft((prev) => ({ ...prev, [id]: clamp(value, max) }));
    };

    const handleSave = () => {
        if (!order.uuid || !canSave) return;
        setError(null);
        const entries = items
            .filter((i) => i.uuid)
            .map((i) => ({ orderItemId: i.uuid as string, qtyDone: draft[i.uuid as string] ?? 0 }));
        const snapshot = { ...draft };
        startTransition(async () => {
            const res = await saveStageProgressAction(order.uuid as string, stage, entries);
            if (res.error) {
                setError(res.error);
                return;
            }
            setSaved(snapshot);
            if (order.uuid) onCompletedChange(order.uuid, !!res.completed);
        });
    };

    // Already complete → compact finished summary; undo lives on the
    // header toggle. Keeps the card tidy once the batch is 100% done.
    if (isCompleted) {
        return (
            <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-green-700 dark:text-green-400">
                    <Check size={16} strokeWidth={3} />
                    {STAGE_LABELS[stage]} completo · {totalPieces}/{totalPieces} pzas
                </div>
                {items.map((item, idx) => (
                    <div
                        key={item.uuid || idx}
                        className="flex items-center gap-3 text-sm bg-green-50/60 dark:bg-green-950/20 rounded-lg px-3 py-2"
                    >
                        <ItemThumb item={item} />
                        <div className="min-w-0 flex-1">
                            <span className="font-medium text-gray-900 dark:text-zinc-100">
                                {item.productName}
                            </span>
                            <span className="text-gray-500 dark:text-zinc-400 ml-2 text-xs">
                                {item.selection.size || ''}
                            </span>
                        </div>
                        <span className="font-bold text-gray-700 dark:text-zinc-200 shrink-0">
                            x{item.quantity}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Progress bar */}
            <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span className="text-gray-600 dark:text-zinc-300">
                        Avance: {doneTotal}/{totalPieces} pzas
                    </span>
                    <span
                        className={
                            allFull
                                ? 'text-green-600 dark:text-green-400'
                                : doneTotal > 0
                                    ? 'text-orange-600 dark:text-orange-400'
                                    : 'text-gray-400 dark:text-zinc-500'
                        }
                    >
                        {pct}%
                    </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${
                            allFull ? 'bg-green-500' : 'bg-orange-500'
                        }`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>

            {/* Per-line inputs */}
            <div className="space-y-1.5">
                {items.map((item, idx) => {
                    const id = item.uuid;
                    const value = id ? draft[id] ?? 0 : 0;
                    const full = value >= item.quantity;
                    return (
                        <div
                            key={id || idx}
                            className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2"
                        >
                            <ItemThumb item={item} />
                            <div className="min-w-0 flex-1">
                                <span className="font-medium text-gray-900 dark:text-zinc-100">
                                    {item.productName}
                                </span>
                                <span className="text-gray-500 dark:text-zinc-400 ml-2 text-xs">
                                    {item.selection.size || ''}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={item.quantity}
                                    disabled={!id || pending}
                                    value={value}
                                    onChange={(e) =>
                                        id && setLine(id, parseInt(e.target.value || '0', 10), item.quantity)
                                    }
                                    onFocus={(e) => e.target.select()}
                                    aria-label={`Piezas completadas de ${item.productName} ${item.selection.size || ''}`}
                                    className={`w-14 text-center font-mono font-bold text-sm rounded-lg border px-1.5 py-1 outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 ${
                                        full
                                            ? 'border-green-400 dark:border-green-700'
                                            : 'border-gray-200 dark:border-zinc-700'
                                    }`}
                                />
                                <span className="text-xs text-gray-400 dark:text-zinc-500 w-10">
                                    / {item.quantity}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => id && setLine(id, item.quantity, item.quantity)}
                                    disabled={!id || pending || full}
                                    className="text-[11px] font-bold px-2 py-1 rounded-md text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                                >
                                    Todo
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {error && (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
            )}

            <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className={`w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    allFull
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
            >
                {pending ? (
                    <Loader2 size={15} className="animate-spin" />
                ) : allFull ? (
                    <Check size={15} strokeWidth={3} />
                ) : (
                    <Save size={15} />
                )}
                {pending
                    ? 'Guardando…'
                    : allFull
                        ? 'Guardar y completar'
                        : dirty
                            ? 'Guardar avance'
                            : savedTotal > 0
                                ? 'Avance guardado'
                                : 'Guardar avance'}
            </button>
        </div>
    );
}

// Small product thumbnail so operators can see the garment they're
// working on. Falls back to a placeholder icon when no image is set.
function ItemThumb({ item }: { item: { imageUrl?: string; productName: string } }) {
    return item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={item.imageUrl}
            alt={item.productName}
            className="w-10 h-10 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-zinc-700"
        />
    ) : (
        <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-zinc-700 shrink-0 flex items-center justify-center">
            <ImageIcon size={16} className="text-gray-400 dark:text-zinc-500" />
        </div>
    );
}
