'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HardHat, LogOut, RefreshCw, Search, Receipt } from 'lucide-react';
import type { Order } from '@/lib/types';
import { signOutAction } from '@/app/login/actions';
import { ThemeToggle } from '@/components/theme-toggle';
import { StageCompleteToggle } from '@/components/admin/stage-complete-toggle';
import { StageTabBar, type StageTab } from '@/components/admin/stage-tab-bar';
import type { StageKey } from '@/lib/services/stage-completions';
import { SubmitInvoiceModal } from '@/components/station/submit-invoice-modal';
import { OrderProductsSummary } from '@/components/admin/order-products-summary';
import { StagePartialEditor } from '@/components/admin/stage-partial-editor';
import type { ItemProgress } from '@/lib/services/stage-item-progress';

interface StationInfo {
    id: string;
    displayName: string;
    stage: StageKey;
    stageLabel: string;
}

interface Props {
    station: StationInfo;
    initialOrders: Order[];
    initialCompletedOrderIds: string[];
    /** Board-wide map of order_item_id → qty done, for the per-line tracker. */
    initialProgress?: ItemProgress;
}

// External station shell — same per-card pattern as the admin stage
// boards but stripped down: no insumo aggregation, no notification
// bells, no admin nav. The station user marks their stage complete
// per order from here.
export function StationBoard({ station, initialOrders, initialCompletedOrderIds, initialProgress }: Props) {
    const router = useRouter();
    const [orders] = useState<Order[]>(initialOrders);
    const [completed, setCompleted] = useState<Set<string>>(
        () => new Set(initialCompletedOrderIds)
    );
    const [tab, setTab] = useState<StageTab>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);

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
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
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
        <div className="max-w-5xl mx-auto px-4 py-6">
            <header className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                        <HardHat size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100">
                            {station.stageLabel}
                        </h1>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            {station.displayName}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowInvoiceModal(true)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 shadow-sm"
                        title="Enviar factura al administrador"
                    >
                        <Receipt size={16} />
                        <span className="hidden sm:inline">Enviar factura</span>
                    </button>
                    <ThemeToggle />
                    <button
                        onClick={() => router.refresh()}
                        className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                        title="Recargar"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <form action={signOutAction}>
                        <button
                            type="submit"
                            className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 rounded-lg"
                            title="Cerrar sesión"
                            aria-label="Cerrar sesión"
                        >
                            <LogOut size={18} />
                        </button>
                    </form>
                </div>
            </header>

            {showInvoiceModal && (
                <SubmitInvoiceModal onClose={() => setShowInvoiceModal(false)} />
            )}

            <StageTabBar tab={tab} setTab={setTab} counts={counts} />

            <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm mb-4">
                <div className="relative w-full">
                    <Search
                        className="absolute left-3 top-2.5 text-gray-400 dark:text-zinc-500"
                        size={18}
                    />
                    <input
                        type="text"
                        placeholder="Buscar por orden o empresa..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-transparent"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400">
                    {orders.length === 0
                        ? 'No tenés pedidos asignados todavía. El admin debe asignarte uno desde Pedidos.'
                        : tab === 'pending'
                            ? 'No hay pedidos pendientes.'
                            : tab === 'done'
                                ? 'Todavía no has marcado ningún pedido completado.'
                                : 'No hay pedidos.'}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    {filtered.map((order) => (
                        <OrderCard
                            key={order.uuid || order.id}
                            order={order}
                            stage={station.stage}
                            isCompleted={!!order.uuid && completed.has(order.uuid)}
                            onLocalChange={handleLocalChange}
                            initialProgress={initialProgress}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function OrderCard({
    order,
    stage,
    isCompleted,
    onLocalChange,
    initialProgress
}: {
    order: Order;
    stage: StageKey;
    isCompleted: boolean;
    onLocalChange: (uuid: string, next: boolean) => void;
    initialProgress?: ItemProgress;
}) {
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
                        orderUuid={order.uuid}
                        orderRef={order.id}
                        stage={stage}
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
                </div>

                {order.notes && (
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 italic line-clamp-2">
                        {order.notes}
                    </p>
                )}
            </div>

            {/* Per-line progress tracker — same as the admin boards, so an
                outsourced workshop records how many pieces of each line it
                has finished. The photo reference list stays collapsible below. */}
            <div className="border-t border-gray-100 dark:border-zinc-800 p-4">
                <StagePartialEditor
                    order={order}
                    stage={stage}
                    initialProgress={initialProgress || {}}
                    isCompleted={isCompleted}
                    onCompletedChange={onLocalChange}
                />
            </div>
        </div>
    );
}
