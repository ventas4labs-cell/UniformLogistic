'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Download, Search, RefreshCw, Loader2, Eye, Receipt, Pencil, Trash2, Filter, Calendar, User, Building2, Bell, X, AlertTriangle, CheckCircle2, Undo2 } from 'lucide-react';
import type { Order } from '@/lib/types';
import type { AdminProduct } from '@/lib/services/products';
import type { MissingInsumoReport } from '@/lib/services/missing-insumos';
import type { StageNotification } from '@/lib/services/stage-notifications';
import type { OrderStatus } from '@/lib/services/orders';
import {
    updateOrderStatusAction,
    deleteOrderAction,
    resolveOrderReportAction,
    unresolveOrderReportAction
} from '@/app/(admin)/admin/orders/actions';
import {
    acknowledgeStageNotificationAction,
    unacknowledgeStageNotificationAction
} from '@/app/(admin)/admin/_stage-actions';
import { StageControlPanel } from '@/components/admin/stage-control-panel';
import { STAGE_ORDER, type StageKey } from '@/lib/services/stage-completions';
import { OrderAssignmentsPanel } from '@/components/admin/order-assignments-panel';
import type { StationUser } from '@/lib/services/station-users';
import type { StationAssignment } from '@/lib/services/station-assignments';
import { FacturaModal } from '@/components/admin/factura-modal';
import { OrderEditModal } from '@/components/admin/order-edit-modal';
import { useRouter } from 'next/navigation';

export function OrdersTable({
    initialOrders,
    products,
    reports: initialReports,
    stageNotifications: initialStageNotifications,
    initialStageCompletions = [],
    stationUsers = [],
    initialAssignments = []
}: {
    initialOrders: Order[];
    products: AdminProduct[];
    reports: MissingInsumoReport[];
    stageNotifications: StageNotification[];
    initialStageCompletions?: { orderId: string; stage: StageKey; completedAt: string }[];
    stationUsers?: StationUser[];
    initialAssignments?: StationAssignment[];
}) {
    const [orders, setOrders] = useState<Order[]>(initialOrders);
    const [reports, setReports] = useState<MissingInsumoReport[]>(initialReports);
    const [stageNotifications, setStageNotifications] = useState<StageNotification[]>(
        initialStageNotifications
    );
    const [searchTerm, setSearchTerm] = useState('');
    // Completion-bucket filter. Replaces the old status-enum chips:
    //   pending     → 0/4 stages done (and not cancelled)
    //   in-progress → 1-3/4 stages done
    //   done        → 4/4 stages done
    //   cancelled   → orders.status === 'cancelled'
    type BucketFilter = 'all' | 'pending' | 'in-progress' | 'done' | 'cancelled';
    const [bucketFilter, setBucketFilter] = useState<BucketFilter>('all');
    // Per-order map of stage → completedAt ISO string. Mutable so admin
    // overrides from the Pedidos card flip the UI immediately, with
    // server actions reconciling on the next router.refresh.
    const [completedAtByOrder, setCompletedAtByOrder] = useState<
        Map<string, Partial<Record<StageKey, string>>>
    >(() => {
        const m = new Map<string, Partial<Record<StageKey, string>>>();
        for (const c of initialStageCompletions) {
            const cur = m.get(c.orderId) || {};
            cur[c.stage] = c.completedAt;
            m.set(c.orderId, cur);
        }
        return m;
    });

    // Per-order map of stationUserId → assignment. Mutable so the
    // assignment panel can flip locally before the server action
    // round-trips. Same pattern as completedAtByOrder above.
    const [assignmentsByOrder, setAssignmentsByOrder] = useState<
        Map<string, Set<string>>
    >(() => {
        const m = new Map<string, Set<string>>();
        for (const a of initialAssignments) {
            const cur = m.get(a.orderId) || new Set<string>();
            cur.add(a.stationUserId);
            m.set(a.orderId, cur);
        }
        return m;
    });

    const handleAssignmentChange = (
        orderId: string,
        stationUserId: string,
        assigned: boolean
    ) => {
        setAssignmentsByOrder((prev) => {
            const next = new Map(prev);
            const cur = new Set(next.get(orderId) || []);
            if (assigned) cur.add(stationUserId);
            else cur.delete(stationUserId);
            next.set(orderId, cur);
            return next;
        });
    };

    const handleStageToggle = (
        uuid: string,
        stage: StageKey,
        completed: boolean,
        completedAt?: string
    ) => {
        setCompletedAtByOrder((prev) => {
            const next = new Map(prev);
            const cur = { ...(next.get(uuid) || {}) };
            if (completed) cur[stage] = completedAt || new Date().toISOString();
            else delete cur[stage];
            next.set(uuid, cur);
            return next;
        });
    };

    // Bucket the order by completion state. Cancelled wins over
    // completion progress.
    const bucketFor = (o: Order): BucketFilter => {
        if (o.status === 'cancelled') return 'cancelled';
        if (!o.uuid) return 'pending';
        const map = completedAtByOrder.get(o.uuid) || {};
        const done = STAGE_ORDER.filter((s) => !!map[s]).length;
        if (done === 0) return 'pending';
        if (done === STAGE_ORDER.length) return 'done';
        return 'in-progress';
    };
    const [pending, startTransition] = useTransition();
    const [facturaOrder, setFacturaOrder] = useState<Order | null>(null);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
    const [deleting, setDeleting] = useState(false);
    // Which order's notification popover is currently open.
    const [notifOrder, setNotifOrder] = useState<Order | null>(null);
    const router = useRouter();

    // Bucket reports + stage notifications by order_id so card rendering
    // can look up unresolved counts in O(1). Kept as a Map so we can
    // also pull the full lists when the popover opens.
    const reportsByOrder = new Map<string, MissingInsumoReport[]>();
    for (const r of reports) {
        const arr = reportsByOrder.get(r.order_id);
        if (arr) arr.push(r);
        else reportsByOrder.set(r.order_id, [r]);
    }
    const stageNotifsByOrder = new Map<string, StageNotification[]>();
    for (const n of stageNotifications) {
        const arr = stageNotifsByOrder.get(n.orderId);
        if (arr) arr.push(n);
        else stageNotifsByOrder.set(n.orderId, [n]);
    }

    // Bell badge count combines unresolved missing-insumo reports +
    // unacknowledged stage notifications so the admin sees a single
    // attention indicator per order.
    const unresolvedCountFor = (uuid: string | undefined): number => {
        if (!uuid) return 0;
        const rs = reportsByOrder.get(uuid) || [];
        const ns = stageNotifsByOrder.get(uuid) || [];
        return (
            rs.filter((r) => !r.resolved).length +
            ns.filter((n) => !n.acknowledgedAt).length
        );
    };

    const handleResolveReport = (reportId: string) => {
        // Optimistic flip
        setReports((prev) =>
            prev.map((r) =>
                r.id === reportId
                    ? { ...r, resolved: true, resolved_at: new Date().toISOString() }
                    : r
            )
        );
        startTransition(async () => {
            try {
                await resolveOrderReportAction(reportId);
            } catch {
                alert('Error al resolver');
                router.refresh();
            }
        });
    };

    const handleUnresolveReport = (reportId: string) => {
        setReports((prev) =>
            prev.map((r) =>
                r.id === reportId ? { ...r, resolved: false, resolved_at: null } : r
            )
        );
        startTransition(async () => {
            try {
                await unresolveOrderReportAction(reportId);
            } catch {
                alert('Error al reabrir');
                router.refresh();
            }
        });
    };

    const handleAcknowledgeStageNotif = (id: string) => {
        setStageNotifications((prev) =>
            prev.map((n) =>
                n.id === id ? { ...n, acknowledgedAt: new Date().toISOString() } : n
            )
        );
        startTransition(async () => {
            try {
                await acknowledgeStageNotificationAction(id);
            } catch {
                alert('Error al marcar visto');
                router.refresh();
            }
        });
    };

    const handleUnacknowledgeStageNotif = (id: string) => {
        setStageNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, acknowledgedAt: null } : n))
        );
        startTransition(async () => {
            try {
                await unacknowledgeStageNotificationAction(id);
            } catch {
                alert('Error al reabrir');
                router.refresh();
            }
        });
    };

    const handleDownloadPdf = async (order: Order) => {
        const { generateAdminPDF } = await import('@/lib/pdf-service');
        const pdf = generateAdminPDF(order);
        pdf.save(`ORDEN_${order.id}.pdf`);
    };

    const handlePreviewPdf = async (order: Order) => {
        const { generateAdminPDF } = await import('@/lib/pdf-service');
        const pdf = generateAdminPDF(order);
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    };

    const handleUpdateStatus = (uuid: string | undefined, newStatus: OrderStatus) => {
        if (!uuid) return;
        setOrders((prev) =>
            prev.map((o) => (o.uuid === uuid ? { ...o, status: newStatus } : o))
        );
        startTransition(async () => {
            try {
                await updateOrderStatusAction(uuid, newStatus);
            } catch {
                alert('Error al actualizar estado');
                router.refresh();
            }
        });
    };

    const totalPieces = (order: Order) =>
        order.items.reduce((s, i) => s + i.quantity, 0);

    const filtered = orders.filter((o) => {
        if (bucketFilter !== 'all' && bucketFor(o) !== bucketFilter) return false;
        const term = searchTerm.toLowerCase();
        if (!term) return true;
        return (
            o.customerName?.toLowerCase().includes(term) ||
            o.companyName?.toLowerCase().includes(term) ||
            o.id?.toLowerCase().includes(term)
        );
    });

    const bucketCounts = orders.reduce(
        (acc, o) => {
            const b = bucketFor(o);
            acc[b] = (acc[b] || 0) + 1;
            return acc;
        },
        {} as Record<BucketFilter, number>
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Pedidos</h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">Logística y control de producción.</p>
                </div>
                <Link
                    href="/catalog"
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md flex items-center gap-2"
                >
                    + Nuevo Pedido
                </Link>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm mb-6 flex justify-between items-center">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-3 text-gray-400 dark:text-zinc-500" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar pedidos..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => router.refresh()}
                    className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                >
                    <RefreshCw size={20} className={pending ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Completion-bucket filter — replaces the old status-enum chips. */}
            <div className="flex flex-wrap gap-2 mb-4">
                {(
                    [
                        { key: 'all', label: 'Todos', count: orders.length, color: 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900' },
                        { key: 'pending', label: 'Sin iniciar', count: bucketCounts['pending'] || 0, color: 'bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300' },
                        { key: 'in-progress', label: 'En proceso', count: bucketCounts['in-progress'] || 0, color: 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300' },
                        { key: 'done', label: 'Listas', count: bucketCounts['done'] || 0, color: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300' },
                        { key: 'cancelled', label: 'Canceladas', count: bucketCounts['cancelled'] || 0, color: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300' }
                    ] as const
                ).map((b) => {
                    if (b.key !== 'all' && b.count === 0) return null;
                    const active = bucketFilter === b.key;
                    return (
                        <button
                            key={b.key}
                            onClick={() => setBucketFilter(b.key)}
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
                                active
                                    ? b.color + ' shadow-md'
                                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                        >
                            {b.key === 'all' && <Filter size={14} />}
                            {b.label} ({b.count})
                        </button>
                    );
                })}
            </div>

            {/* Card grid */}
            {filtered.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400">
                    No se encontraron pedidos.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                    {filtered.map((order) => {
                        const unresolved = unresolvedCountFor(order.uuid);
                        const hasAlert = unresolved > 0;
                        const bucket = bucketFor(order);
                        const isCancelled = bucket === 'cancelled';
                        const completedAt =
                            (order.uuid && completedAtByOrder.get(order.uuid)) || {};
                        const bucketBadge =
                            bucket === 'done'
                                ? { label: 'Lista', color: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300' }
                                : bucket === 'in-progress'
                                    ? { label: 'En proceso', color: 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300' }
                                    : bucket === 'cancelled'
                                        ? { label: 'Cancelada', color: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300' }
                                        : { label: 'Sin iniciar', color: 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300' };
                        return (
                            <div
                                key={order.uuid || order.id}
                                className={`bg-white dark:bg-zinc-900 rounded-xl shadow-sm border transition-all overflow-hidden flex flex-col hover:shadow-md ${
                                    hasAlert
                                        ? 'border-red-300 dark:border-red-900/60 hover:border-red-400 dark:hover:border-red-700/80'
                                        : 'border-gray-200 dark:border-zinc-800 hover:border-orange-200 dark:hover:border-orange-900/60'
                                }`}
                            >
                                <div className="p-4 flex-1 space-y-3">
                                    {/* Header: ID + bell + status */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <p className="font-mono text-base font-bold text-orange-600 dark:text-orange-400">
                                                {order.id}
                                            </p>
                                            {hasAlert && (
                                                <button
                                                    onClick={() => setNotifOrder(order)}
                                                    className="relative inline-flex items-center justify-center p-1.5 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-full hover:bg-red-200 dark:hover:bg-red-950/70 transition-colors animate-pulse"
                                                    title={
                                                        unresolved === 1
                                                            ? '1 notificación sin atender'
                                                            : `${unresolved} notificaciones sin atender`
                                                    }
                                                >
                                                    <Bell size={14} />
                                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                                                        {unresolved > 9 ? '9+' : unresolved}
                                                    </span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className={`py-1 px-3 rounded-full text-xs font-bold ${bucketBadge.color}`}
                                            >
                                                {bucketBadge.label}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleUpdateStatus(
                                                        order.uuid,
                                                        isCancelled ? 'pending' : 'cancelled'
                                                    )
                                                }
                                                disabled={!order.uuid || pending}
                                                title={isCancelled ? 'Reactivar pedido' : 'Cancelar pedido'}
                                                className={`p-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-50 ${
                                                    isCancelled
                                                        ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-950/60'
                                                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-red-100 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-300'
                                                }`}
                                            >
                                                {isCancelled ? <Undo2 size={12} /> : <X size={12} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Company + contact */}
                                    <div className="space-y-1">
                                        <p className="font-semibold text-gray-900 dark:text-zinc-100 flex items-center gap-1.5 truncate">
                                            <Building2
                                                size={14}
                                                className="text-gray-400 dark:text-zinc-500 shrink-0"
                                            />
                                            <span className="truncate">{order.companyName || '—'}</span>
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-zinc-400 flex items-center gap-1.5 truncate">
                                            <User
                                                size={14}
                                                className="text-gray-400 dark:text-zinc-500 shrink-0"
                                            />
                                            <span className="truncate">{order.customerName || '—'}</span>
                                        </p>
                                    </div>

                                    {/* Dates */}
                                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-400">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} />
                                            {new Date(order.dateCreated).toLocaleDateString()}
                                        </span>
                                        {order.deliveryDate && (
                                            <span>
                                                Entrega:{' '}
                                                {new Date(order.deliveryDate).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-xs font-bold px-2 py-1 rounded-full">
                                            {totalPieces(order)} pzas
                                        </span>
                                        <span className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 text-xs font-bold px-2 py-1 rounded-full">
                                            {order.items.length} líneas
                                        </span>
                                        {order.purchaseOrder && (
                                            <span className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs font-medium px-2 py-1 rounded-full">
                                                PO: {order.purchaseOrder}
                                            </span>
                                        )}
                                    </div>

                                    {/* Stage control center — interactive 4-cell
                                        panel. Each cell shows the stage and a
                                        check when done; clicking flips the
                                        completion via the same actions the
                                        stage boards use. Hover for timestamps. */}
                                    <div
                                        className={`rounded-xl border p-3 ${
                                            isCancelled
                                                ? 'opacity-50 pointer-events-none bg-gray-50 dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800'
                                                : 'bg-gray-50 dark:bg-zinc-900/60 border-gray-200 dark:border-zinc-800'
                                        }`}
                                    >
                                        <StageControlPanel
                                            orderUuid={order.uuid}
                                            completedAt={completedAt}
                                            onLocalToggle={handleStageToggle}
                                        />
                                    </div>

                                    {/* Station-user assignments — collapsed by
                                        default. Shows the list of external
                                        stations (corte/maquila/bordado/…) the
                                        admin has assigned this order to and
                                        lets them add/remove. */}
                                    {order.uuid && stationUsers.length > 0 && (
                                        <OrderAssignmentsPanel
                                            orderUuid={order.uuid}
                                            stationUsers={stationUsers}
                                            assignedIds={
                                                assignmentsByOrder.get(order.uuid) || new Set()
                                            }
                                            onLocalChange={handleAssignmentChange}
                                        />
                                    )}

                                    {/* Notes */}
                                    {order.notes && (
                                        <p className="text-xs text-gray-500 dark:text-zinc-400 italic line-clamp-2 bg-gray-50 dark:bg-zinc-800/50 p-2 rounded-lg">
                                            {order.notes}
                                        </p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="grid grid-cols-3 gap-1 p-2 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/40">
                                    <button
                                        onClick={() => handlePreviewPdf(order)}
                                        className="flex items-center justify-center gap-1 text-xs font-bold text-gray-700 dark:text-zinc-300 hover:bg-orange-100 dark:hover:bg-orange-950/40 hover:text-orange-700 dark:hover:text-orange-300 py-2 rounded-lg transition-colors"
                                        title="Ver PDF"
                                    >
                                        <Eye size={14} /> Ver
                                    </button>
                                    <button
                                        onClick={() => handleDownloadPdf(order)}
                                        className="flex items-center justify-center gap-1 text-xs font-bold text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/40 py-2 rounded-lg transition-colors"
                                        title="Descargar PDF"
                                    >
                                        <Download size={14} /> PDF
                                    </button>
                                    <button
                                        onClick={() => setFacturaOrder(order)}
                                        className="flex items-center justify-center gap-1 text-xs font-bold text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-950/40 py-2 rounded-lg transition-colors"
                                        title="Generar factura electrónica"
                                    >
                                        <Receipt size={14} /> Factura
                                    </button>
                                    <button
                                        onClick={() => setEditingOrder(order)}
                                        disabled={!order.uuid}
                                        className="col-span-2 flex items-center justify-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/40 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Editar orden"
                                    >
                                        <Pencil size={14} /> Editar
                                    </button>
                                    <button
                                        onClick={() => setDeletingOrder(order)}
                                        disabled={!order.uuid}
                                        className="flex items-center justify-center gap-1 text-xs font-bold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/40 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Eliminar orden"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {pending && (
                <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
                    <Loader2 className="animate-spin" size={14} />
                    Actualizando...
                </div>
            )}

            {notifOrder && (
                <NotificationsPopover
                    order={notifOrder}
                    reports={(reportsByOrder.get(notifOrder.uuid || '') || []).slice().sort(
                        (a, b) =>
                            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    )}
                    stageNotifs={(
                        stageNotifsByOrder.get(notifOrder.uuid || '') || []
                    ).slice().sort(
                        (a, b) =>
                            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )}
                    onClose={() => setNotifOrder(null)}
                    onResolve={handleResolveReport}
                    onReopen={handleUnresolveReport}
                    onAcknowledgeStage={handleAcknowledgeStageNotif}
                    onUnacknowledgeStage={handleUnacknowledgeStageNotif}
                    pending={pending}
                />
            )}

            {facturaOrder && (
                <FacturaModal order={facturaOrder} onClose={() => setFacturaOrder(null)} />
            )}

            {editingOrder && (
                <OrderEditModal
                    order={editingOrder}
                    products={products}
                    onClose={() => setEditingOrder(null)}
                    onSaved={(next) => {
                        setOrders((prev) =>
                            prev.map((o) => (o.uuid === next.uuid ? next : o))
                        );
                        setEditingOrder(null);
                        router.refresh();
                    }}
                />
            )}

            {deletingOrder && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => !deleting && setDeletingOrder(null)}
                >
                    <div
                        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-2">
                            ¿Eliminar orden {deletingOrder.id}?
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-2">
                            Se eliminarán también todos los artículos, reportes de
                            faltantes y registros de avance asociados.
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-500 mb-5 italic">
                            Las facturas electrónicas ya emitidas se mantendrán
                            (sin enlace a la orden). Esta acción no se puede deshacer.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingOrder(null)}
                                disabled={deleting}
                                className="flex-1 py-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    if (!deletingOrder.uuid) return;
                                    setDeleting(true);
                                    try {
                                        await deleteOrderAction(deletingOrder.uuid);
                                        setOrders((prev) =>
                                            prev.filter((o) => o.uuid !== deletingOrder.uuid)
                                        );
                                        setDeletingOrder(null);
                                        router.refresh();
                                    } catch (e) {
                                        alert(
                                            `Error al eliminar: ${e instanceof Error ? e.message : e}`
                                        );
                                    } finally {
                                        setDeleting(false);
                                    }
                                }}
                                disabled={deleting}
                                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-zinc-700 flex items-center justify-center gap-2"
                            >
                                {deleting && <Loader2 className="animate-spin" size={16} />}
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const STAGE_LABEL: Record<string, string> = {
    bodega: 'Bodega',
    corte: 'Corte',
    maquila: 'Maquila',
    impresion: 'Impresión',
    empaque: 'Empaque'
};

function NotificationsPopover({
    order,
    reports,
    stageNotifs,
    onClose,
    onResolve,
    onReopen,
    onAcknowledgeStage,
    onUnacknowledgeStage,
    pending
}: {
    order: Order;
    reports: MissingInsumoReport[];
    stageNotifs: StageNotification[];
    onClose: () => void;
    onResolve: (id: string) => void;
    onReopen: (id: string) => void;
    onAcknowledgeStage: (id: string) => void;
    onUnacknowledgeStage: (id: string) => void;
    pending: boolean;
}) {
    const unresolved = reports.filter((r) => !r.resolved);
    const resolved = reports.filter((r) => r.resolved);
    const stagePending = stageNotifs.filter((n) => !n.acknowledgedAt);
    const stageDone = stageNotifs.filter((n) => n.acknowledgedAt);

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                            <Bell size={18} className="text-red-500" />
                            Notificaciones
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                            <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                                {order.id}
                            </span>
                            {' · '}
                            {order.companyName || '—'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-4 space-y-4">
                    {stagePending.length > 0 && (
                        <section className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wide text-green-700 dark:text-green-400">
                                Etapas terminadas ({stagePending.length})
                            </h4>
                            {stagePending.map((n) => (
                                <StageNotifRow
                                    key={n.id}
                                    notif={n}
                                    onAcknowledge={onAcknowledgeStage}
                                    onUnacknowledge={onUnacknowledgeStage}
                                    pending={pending}
                                />
                            ))}
                        </section>
                    )}

                    {unresolved.length > 0 && (
                        <section className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                                Faltantes pendientes ({unresolved.length})
                            </h4>
                            {unresolved.map((r) => (
                                <ReportRow
                                    key={r.id}
                                    report={r}
                                    onResolve={onResolve}
                                    onReopen={onReopen}
                                    pending={pending}
                                />
                            ))}
                        </section>
                    )}

                    {resolved.length > 0 && (
                        <section className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-500">
                                Faltantes resueltos ({resolved.length})
                            </h4>
                            {resolved.map((r) => (
                                <ReportRow
                                    key={r.id}
                                    report={r}
                                    onResolve={onResolve}
                                    onReopen={onReopen}
                                    pending={pending}
                                />
                            ))}
                        </section>
                    )}

                    {stageDone.length > 0 && (
                        <section className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-500">
                                Etapas vistas ({stageDone.length})
                            </h4>
                            {stageDone.map((n) => (
                                <StageNotifRow
                                    key={n.id}
                                    notif={n}
                                    onAcknowledge={onAcknowledgeStage}
                                    onUnacknowledge={onUnacknowledgeStage}
                                    pending={pending}
                                />
                            ))}
                        </section>
                    )}

                    {reports.length === 0 && stageNotifs.length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-8">
                            Sin notificaciones.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function StageNotifRow({
    notif,
    onAcknowledge,
    onUnacknowledge,
    pending
}: {
    notif: StageNotification;
    onAcknowledge: (id: string) => void;
    onUnacknowledge: (id: string) => void;
    pending: boolean;
}) {
    const isDone = !!notif.acknowledgedAt;
    return (
        <div
            className={`rounded-lg p-3 border ${
                isDone
                    ? 'bg-gray-50 dark:bg-zinc-800/40 border-gray-100 dark:border-zinc-800'
                    : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/50'
            }`}
        >
            <div className="flex items-start gap-2">
                <CheckCircle2
                    size={16}
                    className={`mt-0.5 shrink-0 ${
                        isDone
                            ? 'text-gray-400 dark:text-zinc-500'
                            : 'text-green-600 dark:text-green-400'
                    }`}
                />
                <div className="flex-1 min-w-0">
                    <p
                        className={`font-bold text-sm ${
                            isDone
                                ? 'text-gray-700 dark:text-zinc-300 line-through'
                                : 'text-green-800 dark:text-green-200'
                        }`}
                    >
                        {STAGE_LABEL[notif.stage] || notif.stage} terminado
                    </p>
                    {notif.message && (
                        <p
                            className={`text-xs mt-0.5 ${
                                isDone
                                    ? 'text-gray-500 dark:text-zinc-500'
                                    : 'text-green-700 dark:text-green-300'
                            }`}
                        >
                            {notif.message}
                        </p>
                    )}
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">
                        {new Date(notif.createdAt).toLocaleString()}
                    </p>
                </div>
                {isDone ? (
                    <button
                        onClick={() => onUnacknowledge(notif.id)}
                        disabled={pending}
                        className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-gray-600 dark:text-zinc-400 hover:text-amber-600 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-amber-300 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        title="Reabrir"
                    >
                        <Undo2 size={12} /> Reabrir
                    </button>
                ) : (
                    <button
                        onClick={() => onAcknowledge(notif.id)}
                        disabled={pending}
                        className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        title="Marcar como visto"
                    >
                        <CheckCircle2 size={12} /> Visto
                    </button>
                )}
            </div>
        </div>
    );
}

function ReportRow({
    report,
    onResolve,
    onReopen,
    pending
}: {
    report: MissingInsumoReport;
    onResolve: (id: string) => void;
    onReopen: (id: string) => void;
    pending: boolean;
}) {
    const isResolved = report.resolved;
    return (
        <div
            className={`rounded-lg p-3 border ${
                isResolved
                    ? 'bg-gray-50 dark:bg-zinc-800/40 border-gray-100 dark:border-zinc-800'
                    : 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50'
            }`}
        >
            <div className="flex items-start gap-2">
                <AlertTriangle
                    size={16}
                    className={`mt-0.5 shrink-0 ${
                        isResolved
                            ? 'text-gray-400 dark:text-zinc-500'
                            : 'text-red-500 dark:text-red-400'
                    }`}
                />
                <div className="flex-1 min-w-0">
                    <p
                        className={`font-bold text-sm ${
                            isResolved
                                ? 'text-gray-700 dark:text-zinc-300 line-through'
                                : 'text-red-800 dark:text-red-200'
                        }`}
                    >
                        {report.insumo_name}
                    </p>
                    <p
                        className={`text-xs mt-0.5 ${
                            isResolved
                                ? 'text-gray-500 dark:text-zinc-500'
                                : 'text-red-700 dark:text-red-300'
                        }`}
                    >
                        Necesita: <strong>{report.required_qty}</strong> · Faltan:{' '}
                        <strong>{report.missing_qty}</strong>
                    </p>
                    {report.notes && (
                        <p className="text-xs text-gray-600 dark:text-zinc-400 italic mt-1">
                            {report.notes}
                        </p>
                    )}
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">
                        {new Date(report.created_at).toLocaleString()}
                    </p>
                </div>
                {isResolved ? (
                    <button
                        onClick={() => onReopen(report.id)}
                        disabled={pending}
                        className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-gray-600 dark:text-zinc-400 hover:text-amber-600 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-amber-300 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        title="Reabrir"
                    >
                        <Undo2 size={12} /> Reabrir
                    </button>
                ) : (
                    <button
                        onClick={() => onResolve(report.id)}
                        disabled={pending}
                        className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        title="Marcar resuelto"
                    >
                        <CheckCircle2 size={12} /> Resolver
                    </button>
                )}
            </div>
        </div>
    );
}
