'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    PackageCheck,
    Clock,
    CheckCircle2,
    Loader2,
    Undo2,
    HardHat
} from 'lucide-react';
import type { Order } from '@/lib/types';
import type { ItemProgress } from '@/lib/services/stage-item-progress';
import { markPickedUpAction } from '@/app/(admin)/admin/_stage-actions';

export interface StationWorkItem {
    order: Order;
    readyForPickupAt: string | null;
    pickedUpAt: string | null;
}

type Phase = 'in-progress' | 'ready' | 'picked';
const phaseOf = (w: StationWorkItem): Phase =>
    w.pickedUpAt ? 'picked' : w.readyForPickupAt ? 'ready' : 'in-progress';

// Readable size label for a line (Hombre M, 32, etc.).
const GENDER_ES: Record<string, string> = { Men: 'Hombre', Women: 'Mujer' };
const sizeLabel = (sel: {
    gender?: string;
    size?: string;
    waist?: number;
}): string =>
    [
        sel.gender ? (GENDER_ES[sel.gender] ?? sel.gender) : '',
        sel.size,
        sel.waist ? `${sel.waist}` : ''
    ]
        .filter(Boolean)
        .join(' ');

// Admin view of one external maquila station's outsourced orders. Shows
// how far along each order is (pieces done per line, reported by the
// station), its pickup status, and lets the office record a pickup.
// Completion is the station's — the office never marks the stage here.
export function ExternalStationPanel({
    stationId,
    stationName,
    items,
    progressByItem
}: {
    stationId: string;
    stationName: string;
    items: StationWorkItem[];
    progressByItem: ItemProgress;
}) {
    const router = useRouter();
    const [picked, setPicked] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(
            items
                .filter((w) => w.order.uuid)
                .map((w) => [w.order.uuid as string, !!w.pickedUpAt])
        )
    );
    const [busyId, setBusyId] = useState<string | null>(null);
    const [errorId, setErrorId] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    const doneFor = (itemUuid: string | undefined, total: number): number =>
        itemUuid ? Math.min(progressByItem[itemUuid] ?? 0, total) : 0;

    const isPicked = (w: StationWorkItem) =>
        w.order.uuid ? (picked[w.order.uuid] ?? !!w.pickedUpAt) : !!w.pickedUpAt;

    const setPickedUp = (w: StationWorkItem, next: boolean) => {
        const uuid = w.order.uuid;
        if (!uuid) return;
        setErrorId(null);
        setBusyId(uuid);
        setPicked((p) => ({ ...p, [uuid]: next }));
        startTransition(async () => {
            const res = await markPickedUpAction(uuid, stationId, next);
            setBusyId(null);
            if (res.error) {
                setPicked((p) => ({ ...p, [uuid]: !next }));
                setErrorId(uuid);
            } else {
                router.refresh();
            }
        });
    };

    // Ready-to-collect first, then in-progress, collected last.
    const sorted = useMemo(() => {
        const rank: Record<Phase, number> = { ready: 0, 'in-progress': 1, picked: 2 };
        return items.slice().sort((a, b) => rank[phaseOf(a)] - rank[phaseOf(b)]);
    }, [items]);

    const readyCount = items.filter(
        (w) => phaseOf(w) === 'ready' && !isPicked(w)
    ).length;

    // Per-station rollup: total pieces done vs. total across all its orders.
    const rollup = useMemo(() => {
        let done = 0;
        let total = 0;
        for (const w of items) {
            for (const it of w.order.items) {
                total += it.quantity;
                done += doneFor(it.uuid, it.quantity);
            }
        }
        return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, progressByItem]);

    if (items.length === 0) {
        return (
            <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <HardHat size={32} className="mx-auto mb-3 opacity-40" />
                <p className="font-semibold">
                    {stationName} no tiene pedidos asignados.
                </p>
                <p className="mt-1 text-sm">
                    Asigná pedidos a esta estación desde Pedidos.
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    <HardHat size={22} className="text-orange-600 dark:text-orange-400" />
                    {stationName}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {items.length} pedido{items.length === 1 ? '' : 's'} ·{' '}
                    <span className="font-bold text-zinc-700 dark:text-zinc-200">
                        {rollup.done}/{rollup.total} pzas
                    </span>{' '}
                    ({rollup.pct}%)
                    {readyCount > 0 && (
                        <span className="ml-2 font-bold text-orange-600 dark:text-orange-400">
                            · {readyCount} listo{readyCount === 1 ? '' : 's'} para recoger
                        </span>
                    )}
                </p>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sorted.map((w) => {
                    const uuid = w.order.uuid;
                    const pickedNow = isPicked(w);
                    const phase: Phase = pickedNow
                        ? 'picked'
                        : w.readyForPickupAt
                          ? 'ready'
                          : 'in-progress';

                    const lines = w.order.items.map((it) => {
                        const total = it.quantity;
                        const done = doneFor(it.uuid, total);
                        return { it, done, total, full: total > 0 && done >= total };
                    });
                    const totalPieces = lines.reduce((s, l) => s + l.total, 0);
                    const donePieces = lines.reduce((s, l) => s + l.done, 0);
                    const pct =
                        totalPieces > 0 ? Math.round((donePieces / totalPieces) * 100) : 0;
                    const allDone = totalPieces > 0 && donePieces >= totalPieces;
                    const busy = busyId === uuid;

                    return (
                        <div
                            key={uuid || w.order.id}
                            className={`overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-zinc-900 ${
                                phase === 'picked'
                                    ? 'border-emerald-300 dark:border-emerald-800/60'
                                    : phase === 'ready'
                                      ? 'border-orange-300 dark:border-orange-500/50'
                                      : 'border-zinc-200 dark:border-zinc-800'
                            }`}
                        >
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <span className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                                            {w.order.id}
                                        </span>
                                        <p className="mt-1 truncate font-semibold text-zinc-900 dark:text-zinc-100">
                                            {w.order.companyName || '—'}
                                        </p>
                                    </div>
                                    <StatusPill phase={phase} />
                                </div>

                                {/* Progress — pieces the station has reported done */}
                                <div className="mt-3">
                                    <div className="mb-1 flex items-baseline justify-between text-xs">
                                        <span className="font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                                            Avance
                                        </span>
                                        <span className="font-bold text-zinc-700 dark:text-zinc-200">
                                            {donePieces}/{totalPieces} pzas ·{' '}
                                            <span
                                                className={
                                                    allDone
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : 'text-orange-600 dark:text-orange-400'
                                                }
                                            >
                                                {pct}%
                                            </span>
                                        </span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                allDone ? 'bg-emerald-500' : 'bg-orange-500'
                                            }`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Per-line done/total */}
                                <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                                    {lines.map((l, i) => {
                                        const label = sizeLabel(l.it.selection || {});
                                        return (
                                            <li
                                                key={l.it.uuid || i}
                                                className="flex items-center justify-between gap-2 text-sm"
                                            >
                                                <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300">
                                                    {l.it.productName}
                                                    {label ? (
                                                        <span className="text-zinc-400 dark:text-zinc-500">
                                                            {' '}· {label}
                                                        </span>
                                                    ) : null}
                                                </span>
                                                <span
                                                    className={`shrink-0 font-mono font-bold tabular-nums ${
                                                        l.full
                                                            ? 'text-emerald-600 dark:text-emerald-400'
                                                            : 'text-zinc-700 dark:text-zinc-200'
                                                    }`}
                                                >
                                                    {l.done}/{l.total}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>

                            <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
                                {phase === 'picked' ? (
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white">
                                            <CheckCircle2 size={16} /> Recogido
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPickedUp(w, false)}
                                            disabled={busy}
                                            title="Deshacer recogido"
                                            aria-label="Deshacer recogido"
                                            className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                        >
                                            {busy ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <Undo2 size={16} />
                                            )}
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setPickedUp(w, true)}
                                            disabled={busy || !uuid}
                                            className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl font-bold text-white shadow-sm active:scale-[0.99] disabled:opacity-60 ${
                                                phase === 'ready'
                                                    ? 'bg-emerald-600 shadow-emerald-600/25 hover:bg-emerald-700'
                                                    : 'bg-zinc-700 hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600'
                                            }`}
                                        >
                                            {busy ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <PackageCheck size={16} />
                                            )}
                                            Marcar recogido
                                        </button>
                                        {errorId === uuid && (
                                            <p className="mt-2 text-center text-xs font-semibold text-red-600 dark:text-red-400">
                                                No se pudo actualizar. Probá de nuevo.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function StatusPill({ phase }: { phase: Phase }) {
    if (phase === 'picked') {
        return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <CheckCircle2 size={12} /> Recogido
            </span>
        );
    }
    if (phase === 'ready') {
        return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
                <PackageCheck size={12} /> Listo para recoger
            </span>
        );
    }
    return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <Clock size={12} /> En proceso
        </span>
    );
}
