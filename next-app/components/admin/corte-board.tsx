'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Scissors,
    RefreshCw,
    Loader2,
    Plus,
    X,
    HardHat
} from 'lucide-react';
import type { Order } from '@/lib/types';
import { StageCompleteToggle } from '@/components/admin/stage-complete-toggle';
import { StageBoardFilters } from '@/components/admin/stage-board-filters';
import { CollapsibleSearch } from '@/components/admin/collapsible-search';
import {
    StageBoardEmptyState,
    StageBoardFilterBar,
    useStageBoardFilters
} from '@/components/admin/stage-board-scope';
import { CompletedSection } from '@/components/admin/completed-section';
import { addCorteExtraItemAction } from '@/app/(admin)/admin/_stage-actions';
import { OrderProductsSummary } from '@/components/admin/order-products-summary';
import { StagePartialEditor } from '@/components/admin/stage-partial-editor';
import type { ItemProgress } from '@/lib/services/stage-item-progress';
import type { CartItem } from '@/lib/types';
import {
    OrderReportButton,
    MissingReportsHistoryButton
} from '@/components/admin/missing-report-controls';
import { CorteFabricReportPanel } from '@/components/admin/corte-fabric-report';
import type { CorteFabricReport } from '@/lib/services/corte-fabric-reports';

const emptyExtra = { productName: '', fabricType: '', size: '', quantity: 1, note: '' };

function OrderCard({
    order,
    isCompleted,
    onLocalCompletionChange,
    initialProgress,
    stationNames = [],
    fabricReports = []
}: {
    order: Order;
    isCompleted: boolean;
    onLocalCompletionChange: (uuid: string, next: boolean) => void;
    initialProgress?: ItemProgress;
    /** External corte station(s) this order is assigned to, if any. */
    stationNames?: string[];
    /** Fabric already reported for this order, one line per tela. */
    fabricReports?: CorteFabricReport[];
}) {
    // Extras added during this session, appended optimistically so the
    // operator sees them immediately. The server data picks them up on
    // the next refresh.
    const [localExtras, setLocalExtras] = useState<CartItem[]>([]);
    const [showExtraForm, setShowExtraForm] = useState(false);
    const [extraForm, setExtraForm] = useState(emptyExtra);
    const [savingExtra, setSavingExtra] = useState(false);
    const [extraError, setExtraError] = useState<string | null>(null);

    const items = [...order.items, ...localExtras];
    const totalPieces = items.reduce((s, i) => s + i.quantity, 0);

    const submitExtra = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!order.uuid) return;
        setSavingExtra(true);
        setExtraError(null);
        const res = await addCorteExtraItemAction(order.uuid, {
            productName: extraForm.productName,
            fabricType: extraForm.fabricType,
            size: extraForm.size,
            quantity: extraForm.quantity,
            note: extraForm.note
        });
        setSavingExtra(false);
        if (res.error) {
            setExtraError(res.error);
            return;
        }
        setLocalExtras((prev) => [
            ...prev,
            {
                uuid: res.itemId,
                productId: 'EXTRA',
                productName: extraForm.productName.trim(),
                selection: { size: extraForm.size.trim() || '—' },
                quantity: extraForm.quantity,
                fabricType: extraForm.fabricType.trim() || undefined,
                note: extraForm.note.trim() || undefined,
                isExtra: true
            }
        ]);
        setExtraForm(emptyExtra);
        setShowExtraForm(false);
    };

    return (
        <div
            className={`bg-white dark:bg-zinc-900 rounded-xl shadow-sm border overflow-hidden ${
                isCompleted
                    ? 'border-emerald-200 dark:border-emerald-900/40'
                    : 'border-zinc-200 dark:border-zinc-800'
            }`}
        >
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                            {order.id}
                        </p>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {order.companyName || '—'}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
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
                        stage="corte"
                        isCompleted={isCompleted}
                        onLocalChange={onLocalCompletionChange}
                    />
                </div>

                <OrderProductsSummary items={items} />

                <div className="flex items-center gap-3 mt-3">
                    <span className="bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-xs font-bold px-2 py-1 rounded-full">
                        {totalPieces} pzas
                    </span>
                    <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold px-2 py-1 rounded-full">
                        {items.length} líneas
                    </span>
                    {localExtras.length > 0 && (
                        <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-bold px-2 py-1 rounded-full">
                            +{localExtras.length} extra
                        </span>
                    )}
                    {stationNames.length > 0 && (
                        <span className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-2 py-1 rounded-full">
                            <HardHat size={12} /> {stationNames.join(', ')}
                        </span>
                    )}
                </div>

                {order.uuid && (
                    <div className="mt-3">
                        <OrderReportButton orderId={order.uuid} stage="corte" />
                    </div>
                )}
            </div>

            {/* Per-line cut progress — same tracker as Bordado. Each row
                carries the full spec (producto, tela, color, talla,
                cantidad), so there's no second table repeating the items
                underneath. */}
            <div className="border-t border-zinc-100 dark:border-zinc-800 p-4">
                <StagePartialEditor
                        locked={stationNames.length > 0}
                    // Includes optimistic extras so a just-added piece
                    // shows in the tracker without waiting for a refresh.
                    order={{ ...order, items }}
                    stage="corte"
                    initialProgress={initialProgress || {}}
                    isCompleted={isCompleted}
                    onCompletedChange={onLocalCompletionChange}
                />
            </div>

            {/* How much tela the cut actually ate, per tela, against the
                BOM estimate. Extras count too — they're cut from the
                same roll — so it reads the same `items` list. */}
            <div className="px-4 pb-4">
                <CorteFabricReportPanel
                    locked={stationNames.length > 0}
                    order={{ ...order, items }}
                    initialReports={fabricReports}
                />
            </div>

                    {/* Add-extra affordance */}
                    <div className="p-3 border-t border-zinc-100 dark:border-zinc-800">
                        {showExtraForm ? (
                            <form
                                onSubmit={submitExtra}
                                className="space-y-2 bg-amber-50/60 dark:bg-amber-950/20 rounded-lg p-3 border border-amber-200 dark:border-amber-900/40"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                        Agregar extra
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowExtraForm(false);
                                            setExtraError(null);
                                        }}
                                        className="text-amber-700 dark:text-amber-300 hover:opacity-70"
                                        aria-label="Cerrar"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    required
                                    placeholder="Producto *"
                                    value={extraForm.productName}
                                    onChange={(e) =>
                                        setExtraForm((f) => ({ ...f, productName: e.target.value }))
                                    }
                                    className="w-full p-2 text-sm border border-amber-200 dark:border-amber-900/40 rounded-lg bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-amber-500"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        placeholder="Tela"
                                        value={extraForm.fabricType}
                                        onChange={(e) =>
                                            setExtraForm((f) => ({ ...f, fabricType: e.target.value }))
                                        }
                                        className="w-full p-2 text-sm border border-amber-200 dark:border-amber-900/40 rounded-lg bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Talla"
                                        value={extraForm.size}
                                        onChange={(e) =>
                                            setExtraForm((f) => ({ ...f, size: e.target.value }))
                                        }
                                        className="w-full p-2 text-sm border border-amber-200 dark:border-amber-900/40 rounded-lg bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="number"
                                        min={1}
                                        required
                                        placeholder="Cantidad *"
                                        value={extraForm.quantity}
                                        onChange={(e) =>
                                            setExtraForm((f) => ({
                                                ...f,
                                                quantity: parseInt(e.target.value, 10) || 1
                                            }))
                                        }
                                        className="w-full p-2 text-sm border border-amber-200 dark:border-amber-900/40 rounded-lg bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Nota (motivo)"
                                        value={extraForm.note}
                                        onChange={(e) =>
                                            setExtraForm((f) => ({ ...f, note: e.target.value }))
                                        }
                                        className="w-full p-2 text-sm border border-amber-200 dark:border-amber-900/40 rounded-lg bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                {extraError && (
                                    <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                                        {extraError}
                                    </p>
                                )}
                                <button
                                    type="submit"
                                    disabled={savingExtra}
                                    className="w-full py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                    {savingExtra ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Plus size={14} />
                                    )}
                                    Agregar
                                </button>
                            </form>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowExtraForm(true)}
                                disabled={!order.uuid || stationNames.length > 0}
                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 disabled:opacity-50"
                            >
                                <Plus size={14} /> Agregar extra
                            </button>
                        )}
                    </div>
        </div>
    );
}

export function CorteBoard({
    initialOrders,
    initialCompletedOrderIds,
    initialProgress,
    assignedStationsByOrder = {},
    fabricReportsByOrder = {}
}: {
    initialOrders: Order[];
    initialCompletedOrderIds: string[];
    initialProgress?: ItemProgress;
    /** orderId → external corte station name(s) assigned to it. */
    assignedStationsByOrder?: Record<string, string[]>;
    /** orderId → fabric consumption already reported for it. */
    fabricReportsByOrder?: Record<string, CorteFabricReport[]>;
}) {
    const [orders] = useState<Order[]>(initialOrders);
    const [completed, setCompleted] = useState<Set<string>>(
        () => new Set(initialCompletedOrderIds)
    );
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

    const handleLocalCompletionChange = (uuid: string, next: boolean) => {
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
            onLocalCompletionChange={handleLocalCompletionChange}
            initialProgress={initialProgress}
            stationNames={stationsFor(order)}
            fabricReports={(order.uuid && fabricReportsByOrder[order.uuid]) || []}
        />
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Scissors size={24} className="text-yellow-600 dark:text-yellow-400" />
                        Corte
                    </h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                        Pedidos en corte: planifica las tallas, telas, colores y cantidades.
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
                    <MissingReportsHistoryButton stage="corte" />
                    <button
                        onClick={() => router.refresh()}
                        className="w-11 h-11 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg"
                        title="Recargar"
                        aria-label="Recargar"
                    >
                        <RefreshCw size={18} className={pending ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <StageBoardFilterBar filters={filters} />

            {filtered.length === 0 ? (
                <StageBoardEmptyState filters={filters} stage="corte" />
            ) : (
                <>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4 items-start">
                        {(splitCompleted ? pendingList : filtered).map(renderCard)}
                    </div>
                    {splitCompleted && (
                        <CompletedSection count={doneList.length}>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4 items-start">
                                {doneList.map(renderCard)}
                            </div>
                        </CompletedSection>
                    )}
                </>
            )}

            {pending && (
                <div className="fixed bottom-4 right-4 bg-zinc-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
                    <Loader2 className="animate-spin" size={14} />
                    Actualizando...
                </div>
            )}
        </div>
    );
}
