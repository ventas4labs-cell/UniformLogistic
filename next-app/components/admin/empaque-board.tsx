'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    PackageCheck,
    RefreshCw,
    Truck,
    CheckCircle2,
    Clock
} from 'lucide-react';
import type { Order } from '@/lib/types';
import { StageCompleteToggle } from '@/components/admin/stage-complete-toggle';
import type { StageTab } from '@/components/admin/stage-tab-bar';
import { StageBoardFilters } from '@/components/admin/stage-board-filters';
import {
    DispatchDestinationModal
} from '@/components/admin/dispatch-destination-modal';
import type { DispatchDestination } from '@/app/(admin)/admin/empaque/actions';
import { CollapsibleSearch } from '@/components/admin/collapsible-search';
import { OrderProductsSummary } from '@/components/admin/order-products-summary';
import {
    OrderReportButton,
    MissingReportsHistoryButton
} from '@/components/admin/missing-report-controls';

interface Props {
    initialOrders: Order[];
    initialCompletedOrderIds: string[];
    /**
     * Map<orderId, Map<orderItemId, dispatchedQty>>. Pre-aggregated
     * server-side so the board can render remaining quantities and
     * dispatch progress without a second round trip.
     */
    initialDispatched: Record<string, Record<string, number>>;
    /**
     * Map<orderId, Map<orderItemId, addedToStockQty>>. Same shape as
     * initialDispatched — how much of each line has already been pushed
     * into the company's stock, so partial adds show remaining.
     */
    initialAddedToStock: Record<string, Record<string, number>>;
}

// ── Dispatch progress helpers ───────────────────────────────────────
// "Out" = pieces that have left production to EITHER channel (entrega or
// the customer's stock). A piece counts once, so the two channels can
// never jointly exceed the ordered quantity.
function orderTotals(
    order: Order,
    dispatched: Map<string, number>,
    stocked: Map<string, number>
): { ordered: number; out: number; remaining: number } {
    let ordered = 0;
    let out = 0;
    for (const it of order.items) {
        ordered += it.quantity;
        if (it.uuid) out += (dispatched.get(it.uuid) || 0) + (stocked.get(it.uuid) || 0);
    }
    return { ordered, out, remaining: Math.max(0, ordered - out) };
}

function OrderCard({
    order,
    isCompleted,
    onLocalChange,
    dispatched,
    addedToStock,
    onDispatch
}: {
    order: Order;
    isCompleted: boolean;
    onLocalChange: (uuid: string, next: boolean) => void;
    dispatched: Map<string, number>;
    addedToStock: Map<string, number>;
    onDispatch: () => void;
}) {
    const totals = orderTotals(order, dispatched, addedToStock);
    const allOut = totals.remaining === 0 && totals.ordered > 0;
    const partial = totals.out > 0 && !allOut;

    return (
        <div
            className={`bg-white dark:bg-zinc-900 rounded-xl shadow-sm border overflow-hidden ${
                isCompleted
                    ? 'border-green-200 dark:border-green-900/40'
                    : 'border-gray-200 dark:border-zinc-800'
            }`}
        >
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                            {order.id}
                        </p>
                        <p className="font-semibold text-gray-900 dark:text-zinc-100 truncate">
                            {order.companyName || '—'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                            {new Date(order.dateCreated).toLocaleDateString()}
                            {order.deliveryDate && (
                                <span className="ml-2">
                                    Entrega: {new Date(order.deliveryDate).toLocaleDateString()}
                                </span>
                            )}
                        </p>
                    </div>
                    <StageCompleteToggle
                        orderUuid={order.uuid}
                        orderRef={order.id}
                        stage="empaque"
                        isCompleted={isCompleted}
                        onLocalChange={onLocalChange}
                    />
                </div>

                <OrderProductsSummary items={order.items} />

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-xs font-bold px-2 py-1 rounded-full">
                        {totals.ordered} pzas
                    </span>
                    <span
                        className={`text-xs font-bold px-2 py-1 rounded-full inline-flex items-center gap-1 ${
                            allOut
                                ? 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300'
                                : partial
                                  ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300'
                        }`}
                    >
                        {allOut ? (
                            <CheckCircle2 size={12} />
                        ) : partial ? (
                            <Truck size={12} />
                        ) : (
                            <Clock size={12} />
                        )}
                        {totals.out} / {totals.ordered} despachado
                    </span>
                </div>

                {order.notes && (
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 italic line-clamp-2">
                        {order.notes}
                    </p>
                )}
            </div>

            {/* Per-line summary so empaque can plan the dispatch without
                opening the modal. Compact rows: name · size · shipped/ordered. */}
            <div className="border-t border-gray-100 dark:border-zinc-800">
                <div className="p-4 space-y-1.5">
                    {order.items.map((item, idx) => {
                        const ship = item.uuid
                            ? (dispatched.get(item.uuid) || 0) +
                              (addedToStock.get(item.uuid) || 0)
                            : 0;
                        const remaining = Math.max(0, item.quantity - ship);
                        const lineDone = remaining === 0;
                        return (
                            <div
                                key={item.uuid || idx}
                                className={`flex items-center gap-3 text-sm rounded-lg px-3 py-2 ${
                                    lineDone
                                        ? 'bg-green-50/60 dark:bg-green-950/20'
                                        : 'bg-gray-50 dark:bg-zinc-800/50'
                                }`}
                            >
                                <div className="min-w-0 flex-1">
                                    <span
                                        className={`font-medium ${
                                            lineDone
                                                ? 'text-green-800 dark:text-green-300 line-through'
                                                : 'text-gray-900 dark:text-zinc-100'
                                        }`}
                                    >
                                        {item.productName}
                                    </span>
                                    <span className="text-gray-500 dark:text-zinc-400 ml-2 text-xs">
                                        {item.selection.size || ''}
                                    </span>
                                </div>
                                <span
                                    className={`text-xs font-mono shrink-0 ${
                                        lineDone
                                            ? 'text-green-700 dark:text-green-300'
                                            : 'text-gray-700 dark:text-zinc-300'
                                    }`}
                                >
                                    {ship} / {item.quantity}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="border-t border-gray-100 dark:border-zinc-800 p-3">
                <button
                    type="button"
                    onClick={onDispatch}
                    disabled={!order.uuid || allOut}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm ${
                        allOut
                            ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 cursor-not-allowed'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                >
                    {allOut ? (
                        <>
                            <CheckCircle2 size={16} /> Totalmente despachado
                        </>
                    ) : (
                        <>
                            <Truck size={16} /> Despachar
                            {partial ? ` (${totals.remaining} restantes)` : ''}
                        </>
                    )}
                </button>
                {order.uuid && (
                    <div className="mt-3">
                        <OrderReportButton orderId={order.uuid} stage="empaque" />
                    </div>
                )}
            </div>
        </div>
    );
}

export function EmpaqueBoard({
    initialOrders,
    initialCompletedOrderIds,
    initialDispatched,
    initialAddedToStock
}: Props) {
    const [orders] = useState<Order[]>(initialOrders);
    const [completed, setCompleted] = useState<Set<string>>(
        () => new Set(initialCompletedOrderIds)
    );
    // Per-order added-to-stock totals — same shape as `dispatched`.
    const [addedToStock, setAddedToStock] = useState<Map<string, Map<string, number>>>(
        () => {
            const m = new Map<string, Map<string, number>>();
            for (const [oid, lines] of Object.entries(initialAddedToStock)) {
                m.set(oid, new Map(Object.entries(lines)));
            }
            return m;
        }
    );
    // Per-order dispatched totals — Map<orderId, Map<orderItemId, qty>>.
    // Mutated optimistically when a dispatch lands so the card progress
    // chip and per-line counts update without a refresh.
    const [dispatched, setDispatched] = useState<Map<string, Map<string, number>>>(
        () => {
            const m = new Map<string, Map<string, number>>();
            for (const [oid, lines] of Object.entries(initialDispatched)) {
                m.set(oid, new Map(Object.entries(lines)));
            }
            return m;
        }
    );
    const [tab, setTab] = useState<StageTab>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [companyFilter, setCompanyFilter] = useState<string>('all');
    const [dispatchTarget, setDispatchTarget] = useState<Order | null>(null);
    const router = useRouter();

    const handleLocalChange = (uuid: string, next: boolean) => {
        setCompleted((prev) => {
            const n = new Set(prev);
            if (next) n.add(uuid);
            else n.delete(uuid);
            return n;
        });
    };

    // After the modal confirms a dispatch, bump the local totals and —
    // if every line is now fully shipped — flip the completion locally
    // too (the server action does the same).
    // After the unified modal confirms, bump the right optimistic ledger
    // per line destination, and flip completion locally when the order is
    // fully covered across both channels (the server does the same).
    const applyResult = (
        orderUuid: string,
        lines: {
            orderItemId: string;
            quantity: number;
            destination: DispatchDestination;
        }[]
    ) => {
        const deliv = lines.filter((l) => l.destination === 'delivery');
        const stk = lines.filter((l) => l.destination === 'stock');
        const bump = (
            setter: typeof setDispatched,
            rows: typeof deliv
        ) =>
            setter((prev) => {
                const next = new Map(prev);
                const perOrder = new Map(next.get(orderUuid) || []);
                for (const l of rows)
                    perOrder.set(l.orderItemId, (perOrder.get(l.orderItemId) || 0) + l.quantity);
                next.set(orderUuid, perOrder);
                return next;
            });
        if (deliv.length) bump(setDispatched, deliv);
        if (stk.length) bump(setAddedToStock, stk);

        const order = orders.find((o) => o.uuid === orderUuid);
        if (order) {
            const d = new Map(dispatched.get(orderUuid) || []);
            const s = new Map(addedToStock.get(orderUuid) || []);
            for (const l of deliv) d.set(l.orderItemId, (d.get(l.orderItemId) || 0) + l.quantity);
            for (const l of stk) s.set(l.orderItemId, (s.get(l.orderItemId) || 0) + l.quantity);
            const t = orderTotals(order, d, s);
            if (t.remaining === 0 && t.ordered > 0) {
                setCompleted((prev) => new Set(prev).add(orderUuid));
            }
        }
    };

    const tabFiltered = useMemo(() => {
        if (tab === 'all') return orders;
        if (tab === 'done') return orders.filter((o) => o.uuid && completed.has(o.uuid));
        return orders.filter((o) => !(o.uuid && completed.has(o.uuid)));
    }, [orders, completed, tab]);

    const filtered = tabFiltered.filter((o) => {
        if (companyFilter !== 'all' && o.companyName !== companyFilter) return false;
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            o.customerName?.toLowerCase().includes(term) ||
            o.companyName?.toLowerCase().includes(term) ||
            o.id?.toLowerCase().includes(term)
        );
    });

    const counts = {
        pending: orders.filter((o) => !(o.uuid && completed.has(o.uuid))).length,
        done: orders.filter((o) => o.uuid && completed.has(o.uuid)).length,
        all: orders.length
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <PackageCheck size={24} className="text-emerald-600 dark:text-emerald-400" />
                        Empaque
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Despachá productos por línea — total o parcial. El pedido se
                        marca completado automáticamente cuando todo sale.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <CollapsibleSearch
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Buscar por orden, empresa o cliente…"
                    />
                    <StageBoardFilters
                        orders={orders}
                        counts={counts}
                        tab={tab}
                        setTab={setTab}
                        companyFilter={companyFilter}
                        setCompanyFilter={setCompanyFilter}
                    />
                    <MissingReportsHistoryButton stage="empaque" />
                    <button
                        onClick={() => router.refresh()}
                        className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                        title="Recargar"
                        aria-label="Recargar"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400">
                    {tab === 'pending'
                        ? 'No hay pedidos pendientes de empaque.'
                        : tab === 'done'
                            ? 'Todavía no se ha completado ningún pedido en empaque.'
                            : 'No hay pedidos.'}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                    {filtered.map((order) => (
                        <OrderCard
                            key={order.uuid || order.id}
                            order={order}
                            isCompleted={!!order.uuid && completed.has(order.uuid)}
                            onLocalChange={handleLocalChange}
                            dispatched={
                                (order.uuid && dispatched.get(order.uuid)) || new Map()
                            }
                            addedToStock={
                                (order.uuid && addedToStock.get(order.uuid)) || new Map()
                            }
                            onDispatch={() => setDispatchTarget(order)}
                        />
                    ))}
                </div>
            )}

            {dispatchTarget && dispatchTarget.uuid && (
                <DispatchDestinationModal
                    order={dispatchTarget}
                    dispatched={dispatched.get(dispatchTarget.uuid) || new Map()}
                    stocked={addedToStock.get(dispatchTarget.uuid) || new Map()}
                    onClose={() => setDispatchTarget(null)}
                    onApplied={(lines) => {
                        if (dispatchTarget.uuid) applyResult(dispatchTarget.uuid, lines);
                        setDispatchTarget(null);
                    }}
                />
            )}
        </div>
    );
}
