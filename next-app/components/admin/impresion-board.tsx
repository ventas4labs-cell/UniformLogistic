'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Printer, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import type { Order } from '@/lib/types';
import type { Logo } from '@/lib/services/logos';
import { StageCompleteToggle } from '@/components/admin/stage-complete-toggle';
import type { StageTab } from '@/components/admin/stage-tab-bar';
import { StageBoardFilters } from '@/components/admin/stage-board-filters';
import { CollapsibleSearch } from '@/components/admin/collapsible-search';
import { OrderLogosButton } from '@/components/admin/order-logos-modal';
import { OrderProductsSummary } from '@/components/admin/order-products-summary';

// Cards are uniform: at most this many item rows show, with a
// min-height so short orders match; longer orders collapse behind an
// expand chevron so one big order can't tower over the grid.
const MAX_VISIBLE_ITEMS = 4;

function OrderCard({
    order,
    isCompleted,
    onLocalChange,
    logos
}: {
    order: Order;
    isCompleted: boolean;
    onLocalChange: (uuid: string, next: boolean) => void;
    logos: Logo[];
}) {
    const totalPieces = order.items.reduce((s, i) => s + i.quantity, 0);
    const [expanded, setExpanded] = useState(false);
    const visibleItems = expanded
        ? order.items
        : order.items.slice(0, MAX_VISIBLE_ITEMS);
    const hiddenCount = Math.max(0, order.items.length - MAX_VISIBLE_ITEMS);

    return (
        <div
            className={`bg-white dark:bg-zinc-900 rounded-xl shadow-sm border overflow-hidden flex flex-col ${
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
                        stage="impresion"
                        isCompleted={isCompleted}
                        onLocalChange={onLocalChange}
                    />
                </div>

                <OrderProductsSummary items={order.items} />

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-xs font-bold px-2 py-1 rounded-full">
                        {totalPieces} pzas
                    </span>
                    <span className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 text-xs font-bold px-2 py-1 rounded-full">
                        {order.items.length} líneas
                    </span>
                    <OrderLogosButton
                        order={order}
                        category="impresion"
                        logos={logos}
                    />
                </div>

                {order.notes && (
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 italic line-clamp-2">
                        {order.notes}
                    </p>
                )}
            </div>

            <div className="border-t border-gray-100 dark:border-zinc-800 flex-1 flex flex-col">
                <div className="p-4 flex flex-col flex-1 min-h-[160px]">
                    <div className="space-y-1.5">
                        {visibleItems.map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-3 text-sm bg-gray-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2"
                            >
                                <div className="min-w-0 flex-1">
                                    <span className="font-medium text-gray-900 dark:text-zinc-100">
                                        {item.productName}
                                    </span>
                                    <span className="text-gray-500 dark:text-zinc-400 ml-2 text-xs">
                                        {item.selection.size || ''}
                                    </span>
                                </div>
                                <span className="font-bold text-gray-700 dark:text-zinc-200 shrink-0 ml-2">
                                    x{item.quantity}
                                </span>
                            </div>
                        ))}
                    </div>
                    {hiddenCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setExpanded((e) => !e)}
                            className="mt-auto pt-3 flex items-center justify-center gap-1 text-xs font-bold text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
                            aria-expanded={expanded}
                        >
                            {expanded ? (
                                <>
                                    <ChevronUp size={14} /> Ver menos
                                </>
                            ) : (
                                <>
                                    <ChevronDown size={14} /> +{hiddenCount} líneas más
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export function ImpresionBoard({
    initialOrders,
    initialCompletedOrderIds,
    logos
}: {
    initialOrders: Order[];
    initialCompletedOrderIds: string[];
    logos: Logo[];
}) {
    const [orders] = useState<Order[]>(initialOrders);
    const [completed, setCompleted] = useState<Set<string>>(
        () => new Set(initialCompletedOrderIds)
    );
    const [tab, setTab] = useState<StageTab>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [companyFilter, setCompanyFilter] = useState<string>('all');
    const router = useRouter();

    const handleLocalChange = (uuid: string, next: boolean) => {
        setCompleted((prev) => {
            const n = new Set(prev);
            if (next) n.add(uuid);
            else n.delete(uuid);
            return n;
        });
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
                        <Printer size={24} className="text-pink-600 dark:text-pink-400" />
                        Impresión
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Cada pedido aparece acá apenas se crea. Marcalo como
                        completado cuando la impresión esté lista.
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
                        ? 'No hay pedidos pendientes de impresión.'
                        : tab === 'done'
                            ? 'Todavía no se ha completado ningún pedido en impresión.'
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
                            logos={logos}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
