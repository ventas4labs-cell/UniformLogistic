'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Factory,
    RefreshCw,
    Loader2,
    ChevronDown,
    ChevronUp,
    HardHat
} from 'lucide-react';
import { ProductThumb, useProductZoom } from '@/components/admin/product-thumb';
import type { Order } from '@/lib/types';
import type { InsumoCompletion } from '@/lib/services/insumo-completions';
import { aggregateInsumos } from '@/lib/stage-utils';
import { StageCompleteToggle } from '@/components/admin/stage-complete-toggle';
import { CollapsibleSearch } from '@/components/admin/collapsible-search';
import { CompletedSection } from '@/components/admin/completed-section';
import { StageBoardFilters } from '@/components/admin/stage-board-filters';
import {
    StageBoardEmptyState,
    StageBoardFilterBar,
    useStageBoardFilters
} from '@/components/admin/stage-board-scope';
import {
    InsumoRow,
    completionKey,
    useToggleInsumoCompletion
} from '@/components/admin/insumo-row';
import { OrderProductsSummary } from '@/components/admin/order-products-summary';
import { MissingReportsHistoryButton } from '@/components/admin/missing-report-controls';

function OrderCard({
    order,
    isCompleted,
    onLocalChange,
    completedInsumos,
    onToggleInsumo,
    stationNames = []
}: {
    order: Order;
    isCompleted: boolean;
    onLocalChange: (uuid: string, next: boolean) => void;
    completedInsumos: Set<string>;
    onToggleInsumo: (orderId: string, insumoName: string, completed: boolean) => void;
    /** External maquila station(s) this order is assigned to, if any. */
    stationNames?: string[];
}) {
    const [expanded, setExpanded] = useState(true);
    // Tapping a line's thumbnail opens the product full-size.
    const { openZoom, zoomModal } = useProductZoom();
    const insumos = aggregateInsumos(order.items);
    const totalPieces = order.items.reduce((s, i) => s + i.quantity, 0);

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
                        locked={stationNames.length > 0}
                        orderUuid={order.uuid}
                        orderRef={order.id}
                        stage="maquila"
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
                    {stationNames.length > 0 && (
                        <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 text-xs font-bold px-2 py-1 rounded-full">
                            <HardHat size={12} /> {stationNames.join(', ')}
                        </span>
                    )}
                    {insumos.length > 0 && (
                        <span className="bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 text-xs font-bold px-2 py-1 rounded-full">
                            {insumos.length} insumos
                        </span>
                    )}
                </div>

                {order.notes && (
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 italic line-clamp-2">
                        {order.notes}
                    </p>
                )}
            </div>

            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-1 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 transition-colors"
            >
                {expanded ? (
                    <>
                        Ocultar detalle <ChevronUp size={14} />
                    </>
                ) : (
                    <>
                        Ver detalle <ChevronDown size={14} />
                    </>
                )}
            </button>

            {expanded && (
                <div className="border-t border-gray-100 dark:border-zinc-800">
                    <div className="p-4 space-y-3">
                        <h4 className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
                            Artículos
                        </h4>
                        <div className="space-y-1.5">
                            {order.items.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-3 text-sm bg-gray-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2"
                                >
                                    <ProductThumb item={item} onZoom={openZoom} />
                                    <div className="min-w-0 flex-1">
                                        <span className="font-medium text-gray-900 dark:text-zinc-100">
                                            {item.productName}
                                        </span>
                                        <span className="text-gray-500 dark:text-zinc-400 ml-2 text-xs">
                                            {item.selection.size || ''}
                                        </span>
                                        {item.fabricType && (
                                            <span className="text-gray-400 dark:text-zinc-500 ml-1 text-xs">
                                                · {item.fabricType}
                                            </span>
                                        )}
                                    </div>
                                    <span className="font-bold text-gray-700 dark:text-zinc-200 shrink-0 ml-2">
                                        x{item.quantity}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {insumos.length > 0 && (
                            <>
                                <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide pt-2">
                                    Insumos necesarios
                                </h4>
                                <div className="space-y-1.5">
                                    {insumos.map((ins) => {
                                        const done =
                                            !!order.uuid &&
                                            completedInsumos.has(
                                                completionKey(order.uuid, ins.name)
                                            );
                                        return (
                                            <InsumoRow
                        locked={stationNames.length > 0}
                                                key={ins.name}
                                                ins={ins}
                                                orderUuid={order.uuid}
                                                isCompleted={done}
                                                stage="maquila"
                                                onToggleComplete={(completed) =>
                                                    order.uuid &&
                                                    onToggleInsumo(order.uuid, ins.name, completed)
                                                }
                                            />
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            {zoomModal}
        </div>
    );
}

export function MaquilaBoard({
    initialOrders,
    initialCompletedOrderIds,
    initialInsumoCompletions,
    assignedStationsByOrder = {}
}: {
    initialOrders: Order[];
    initialCompletedOrderIds: string[];
    initialInsumoCompletions: InsumoCompletion[];
    /**
     * orderId → external maquila station name(s). Outsourced orders stay
     * on this board (badged + filterable) instead of disappearing, so
     * the taller view is the whole picture.
     */
    assignedStationsByOrder?: Record<string, string[]>;
}) {
    const [orders] = useState<Order[]>(initialOrders);
    const [completed, setCompleted] = useState<Set<string>>(
        () => new Set(initialCompletedOrderIds)
    );
    const [completedInsumos, setCompletedInsumos] = useState<Set<string>>(
        () =>
            new Set(
                initialInsumoCompletions.map((c) =>
                    completionKey(c.orderId, c.insumoName)
                )
            )
    );
    const handleToggleInsumo = useToggleInsumoCompletion(setCompletedInsumos);
    const filters = useStageBoardFilters({ orders, completed, assignedStationsByOrder });
    const {
        tab,
        setTab,
        searchTerm,
        setSearchTerm,
        companyFilter,
        setCompanyFilter,
        stationsFor,
        isDone,
        statusCounts,
        filtered,
        pendingList,
        doneList,
        splitCompleted
    } = filters;
    const [pending] = useTransition();
    const router = useRouter();

    const handleLocalChange = (uuid: string, next: boolean) => {
        setCompleted((prev) => {
            const n = new Set(prev);
            if (next) n.add(uuid);
            else n.delete(uuid);
            return n;
        });
    };

    const renderCard = (order: Order) => (
        <OrderCard
            key={order.uuid || order.id}
            order={order}
            isCompleted={isDone(order)}
            onLocalChange={handleLocalChange}
            completedInsumos={completedInsumos}
            onToggleInsumo={handleToggleInsumo}
            stationNames={stationsFor(order)}
        />
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <Factory size={24} className="text-orange-600 dark:text-orange-400" />
                        Maquila
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Cada pedido aparece acá apenas se crea. Marcalo como
                        completado cuando la maquila esté lista.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <CollapsibleSearch
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Buscar por orden, empresa o cliente…"
                    />
                    {/* Estado lives on the board below, so the popover
                        only carries the company filter here. */}
                    <StageBoardFilters
                        orders={orders}
                        counts={statusCounts}
                        tab={tab}
                        setTab={setTab}
                        companyFilter={companyFilter}
                        setCompanyFilter={setCompanyFilter}
                        showStatus={false}
                    />
                    <MissingReportsHistoryButton stage="maquila" />
                    <button
                        onClick={() => router.refresh()}
                        className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                        title="Recargar"
                        aria-label="Recargar"
                    >
                        <RefreshCw size={18} className={pending ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <StageBoardFilterBar filters={filters} />

            {filtered.length === 0 ? (
                <StageBoardEmptyState filters={filters} stage="maquila" />
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                        {(splitCompleted ? pendingList : filtered).map(renderCard)}
                    </div>
                    {splitCompleted && (
                        <CompletedSection count={doneList.length}>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                                {doneList.map(renderCard)}
                            </div>
                        </CompletedSection>
                    )}
                </>
            )}

            {pending && (
                <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
                    <Loader2 className="animate-spin" size={14} />
                    Actualizando...
                </div>
            )}
        </div>
    );
}

