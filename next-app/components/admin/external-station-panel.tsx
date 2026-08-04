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
import { markPickedUpAction } from '@/app/(admin)/admin/_stage-actions';
import { OrderProductsSummary } from '@/components/admin/order-products-summary';
import { StageCompleteToggle } from '@/components/admin/stage-complete-toggle';

export interface StationWorkItem {
    order: Order;
    readyForPickupAt: string | null;
    pickedUpAt: string | null;
}

type Phase = 'in-progress' | 'ready' | 'picked';
const phaseOf = (w: StationWorkItem): Phase =>
    w.pickedUpAt ? 'picked' : w.readyForPickupAt ? 'ready' : 'in-progress';

// Admin view of one external maquila station's outsourced orders. The
// station flags each "listo para recoger"; the office records the pickup
// here, which also completes the maquila stage in-house.
export function ExternalStationPanel({
    stationId,
    stationName,
    items,
    completedOrderIds
}: {
    stationId: string;
    stationName: string;
    items: StationWorkItem[];
    completedOrderIds: string[];
}) {
    const router = useRouter();
    const [picked, setPicked] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(
            items
                .filter((w) => w.order.uuid)
                .map((w) => [w.order.uuid as string, !!w.pickedUpAt])
        )
    );
    // Stage completion is a separate admin step from pickup.
    const [completed, setCompleted] = useState<Set<string>>(
        () => new Set(completedOrderIds)
    );
    const handleCompletionChange = (uuid: string, next: boolean) =>
        setCompleted((prev) => {
            const n = new Set(prev);
            if (next) n.add(uuid);
            else n.delete(uuid);
            return n;
        });
    const [busyId, setBusyId] = useState<string | null>(null);
    const [errorId, setErrorId] = useState<string | null>(null);
    const [, startTransition] = useTransition();

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
        return items
            .slice()
            .sort((a, b) => rank[phaseOf(a)] - rank[phaseOf(b)]);
    }, [items]);

    const readyCount = items.filter(
        (w) => phaseOf(w) === 'ready' && !isPicked(w)
    ).length;

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
            <div className="mb-4 flex items-baseline justify-between gap-2">
                <h2 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    <HardHat size={22} className="text-orange-600 dark:text-orange-400" />
                    {stationName}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {items.length} pedido{items.length === 1 ? '' : 's'}
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
                    const totalPieces = w.order.items.reduce(
                        (s, i) => s + i.quantity,
                        0
                    );
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
                                    {/* Stage completion — a separate step from pickup. */}
                                    <StageCompleteToggle
                                        orderUuid={uuid}
                                        orderRef={w.order.id}
                                        stage="maquila"
                                        isCompleted={!!uuid && completed.has(uuid)}
                                        onLocalChange={handleCompletionChange}
                                    />
                                </div>

                                <div className="mt-2">
                                    <OrderProductsSummary items={w.order.items} />
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <StatusPill phase={phase} />
                                    <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-bold text-orange-800 dark:bg-orange-950/50 dark:text-orange-300">
                                        {totalPieces} pzas
                                    </span>
                                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                        {w.order.items.length} líneas
                                    </span>
                                </div>
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
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <CheckCircle2 size={12} /> Recogido
            </span>
        );
    }
    if (phase === 'ready') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
                <PackageCheck size={12} /> Listo para recoger
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <Clock size={12} /> En proceso
        </span>
    );
}
