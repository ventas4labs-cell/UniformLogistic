'use client';

import { useMemo, useState } from 'react';
import {
    Truck,
    Package,
    Building2,
    User,
    Check,
    Loader2,
    AlertTriangle,
    PartyPopper
} from 'lucide-react';
import { markOrderDeliveredByDriverAction } from '@/app/d/[token]/actions';

// One order on the driver's plan. `effectiveDate` already accounts for
// rollover: an overdue, still-undelivered order carries today's date so
// it surfaces under "Hoy" until the driver delivers it. `scheduledDate`
// keeps the original planned day so the card can show "programado …".
export interface DriverOrder {
    orderId: string;
    orderRef: string;
    companyName: string;
    contactName: string;
    scheduledDate: string;
    effectiveDate: string;
    overdue: boolean;
    totalPieces: number;
    items: { name: string; size: string; quantity: number }[];
}

function fmtDate(iso: string): string {
    const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
    return `${d}/${m}/${y}`;
}

export function DriverDeliveryList({
    token,
    initialOrders,
    todayIso,
    tomorrowIso
}: {
    token: string;
    initialOrders: DriverOrder[];
    todayIso: string;
    tomorrowIso: string;
}) {
    const [orders, setOrders] = useState<DriverOrder[]>(initialOrders);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [doneId, setDoneId] = useState<string | null>(null);
    const [errorId, setErrorId] = useState<string | null>(null);

    const heading = (iso: string): string => {
        if (iso === todayIso) return `Hoy · ${fmtDate(iso)}`;
        if (iso === tomorrowIso) return `Mañana · ${fmtDate(iso)}`;
        return fmtDate(iso);
    };

    // Live pending count — the delivered card lingers ~1s as a success
    // flash before it leaves the list, so exclude it from the tally.
    const pendingCount = orders.filter((o) => o.orderId !== doneId).length;

    const groups = useMemo(() => {
        const m = new Map<string, DriverOrder[]>();
        for (const o of orders) {
            const arr = m.get(o.effectiveDate);
            if (arr) arr.push(o);
            else m.set(o.effectiveDate, [o]);
        }
        return Array.from(m.entries())
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(
                ([date, list]) =>
                    [
                        date,
                        // Most-overdue first within a day.
                        list
                            .slice()
                            .sort((x, y) =>
                                x.scheduledDate < y.scheduledDate ? -1 : 1
                            )
                    ] as const
            );
    }, [orders]);

    const confirmDeliver = async (o: DriverOrder) => {
        setConfirmingId(null);
        setErrorId(null);
        setPendingId(o.orderId);
        const res = await markOrderDeliveredByDriverAction(token, o.orderId);
        setPendingId(null);
        if (res.error) {
            setErrorId(o.orderId);
            return;
        }
        setDoneId(o.orderId);
        // Brief "¡Entregado!" flash, then drop it from the plan.
        setTimeout(() => {
            setOrders((prev) => prev.filter((x) => x.orderId !== o.orderId));
            setDoneId((d) => (d === o.orderId ? null : d));
        }, 1000);
    };

    return (
        <main className="min-h-[100dvh] bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
            <header className="sticky top-0 z-20 bg-orange-600 text-white px-4 py-3 shadow-md">
                <div className="mx-auto flex max-w-lg items-center gap-2.5">
                    <Truck size={22} className="shrink-0" />
                    <div className="min-w-0">
                        <h1 className="font-extrabold leading-tight">Plan de entregas</h1>
                        <p className="text-[11px] text-orange-100">
                            {pendingCount === 0
                                ? 'Todo entregado'
                                : `${pendingCount} pedido${pendingCount === 1 ? '' : 's'} por entregar`}
                        </p>
                    </div>
                </div>
            </header>

            <div className="mx-auto w-full max-w-lg px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                {pendingCount === 0 ? (
                    <div className="py-20 text-center text-zinc-500 dark:text-zinc-400">
                        <PartyPopper size={40} className="mx-auto mb-3 text-emerald-500" />
                        <p className="text-lg font-extrabold text-zinc-700 dark:text-zinc-200">
                            No hay entregas pendientes
                        </p>
                        <p className="mt-1 text-sm">Cuando la oficina programe pedidos, aparecen acá.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groups.map(([date, list]) => {
                            const hasOverdue = list.some((o) => o.overdue);
                            return (
                                <section key={date}>
                                    <div className="sticky top-14 z-10 -mx-4 mb-2 bg-zinc-100/90 px-4 py-1.5 backdrop-blur dark:bg-zinc-950/90">
                                        <h2 className="flex flex-wrap items-baseline gap-x-2 text-sm font-extrabold uppercase tracking-wide text-orange-700 dark:text-orange-400">
                                            {heading(date)}
                                            <span className="font-bold normal-case text-zinc-500 dark:text-zinc-400">
                                                {list.length} pedido{list.length === 1 ? '' : 's'}
                                            </span>
                                            {hasOverdue && date === todayIso && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold normal-case text-red-700 dark:bg-red-950/50 dark:text-red-300">
                                                    <AlertTriangle size={11} /> incluye atrasados
                                                </span>
                                            )}
                                        </h2>
                                    </div>

                                    <div className="space-y-3">
                                        {list.map((o) => {
                                            const isPending = pendingId === o.orderId;
                                            const isDone = doneId === o.orderId;
                                            const isConfirming = confirmingId === o.orderId;
                                            const isError = errorId === o.orderId;
                                            return (
                                                <article
                                                    key={o.orderId}
                                                    className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors dark:bg-zinc-900 ${
                                                        isDone
                                                            ? 'border-emerald-300 dark:border-emerald-800/60'
                                                            : o.overdue
                                                              ? 'border-red-200 dark:border-red-900/50'
                                                              : 'border-zinc-200 dark:border-zinc-800'
                                                    }`}
                                                >
                                                    <div className="p-4">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                                                                {o.orderRef}
                                                            </span>
                                                            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-extrabold text-orange-800 dark:bg-orange-950/50 dark:text-orange-300">
                                                                {o.totalPieces} pzas
                                                            </span>
                                                        </div>

                                                        {o.overdue && (
                                                            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                                                                <AlertTriangle size={13} />
                                                                Atrasado · programado {fmtDate(o.scheduledDate)}
                                                            </p>
                                                        )}

                                                        <p className="mt-1.5 flex items-center gap-1.5 text-lg font-bold leading-tight">
                                                            <Building2 size={16} className="shrink-0 text-zinc-400" />
                                                            {o.companyName || '—'}
                                                        </p>
                                                        {o.contactName && (
                                                            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                                                                <User size={13} /> {o.contactName}
                                                            </p>
                                                        )}

                                                        {o.items.length > 0 && (
                                                            <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                                                                {o.items.map((it, i) => (
                                                                    <li
                                                                        key={i}
                                                                        className="flex items-center justify-between text-sm"
                                                                    >
                                                                        <span className="text-zinc-700 dark:text-zinc-300">
                                                                            {it.name}
                                                                            {it.size ? (
                                                                                <span className="text-zinc-400 dark:text-zinc-500">
                                                                                    {' '}· {it.size}
                                                                                </span>
                                                                            ) : null}
                                                                        </span>
                                                                        <span className="ml-2 shrink-0 font-mono font-bold text-zinc-700 dark:text-zinc-200">
                                                                            ×{it.quantity}
                                                                        </span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </div>

                                                    {/* Action zone — the driver's one job per card */}
                                                    <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
                                                        {isDone ? (
                                                            <div className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white">
                                                                <Check size={18} strokeWidth={3} />
                                                                ¡Entregado!
                                                            </div>
                                                        ) : isConfirming ? (
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setConfirmingId(null)}
                                                                    className="h-12 flex-1 rounded-xl border border-zinc-300 font-bold text-zinc-700 active:scale-[0.98] dark:border-zinc-700 dark:text-zinc-300"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => confirmDeliver(o)}
                                                                    className="flex h-12 flex-[1.6] items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-700 active:scale-[0.98]"
                                                                >
                                                                    <Check size={18} strokeWidth={3} />
                                                                    Sí, entregado
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    disabled={isPending}
                                                                    onClick={() => setConfirmingId(o.orderId)}
                                                                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
                                                                >
                                                                    {isPending ? (
                                                                        <>
                                                                            <Loader2 size={18} className="animate-spin" />
                                                                            Guardando…
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Truck size={18} />
                                                                            Marcar entregado
                                                                        </>
                                                                    )}
                                                                </button>
                                                                {isError && (
                                                                    <p className="mt-2 text-center text-xs font-semibold text-red-600 dark:text-red-400">
                                                                        No se pudo marcar. Revisá la señal y probá de nuevo.
                                                                    </p>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}

                <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-[11px] text-zinc-400 dark:text-zinc-600">
                    <Package size={12} /> Uniform Logistic · Plan de entregas
                </p>
            </div>
        </main>
    );
}
