'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Search,
    RefreshCw,
    Loader2,
    ChevronDown,
    ChevronUp,
    Package,
    Scissors,
    Factory,
    Printer,
    PackageCheck,
    CheckCircle2,
    Clock,
    XCircle,
    Filter,
    AlertTriangle,
    X,
    Send,
    ImageIcon,
    Check,
} from 'lucide-react';
import type { Order, CartItem } from '@/lib/types';
import { ORDER_STATUS_OPTIONS, OrderStatus } from '@/lib/services/orders';
import type { InsumoCompletion } from '@/lib/services/insumo-completions';
import {
    updateOrderStatusAction,
    reportMissingInsumoAction,
    toggleInsumoCompleteAction,
} from '@/app/(admin)/admin/operador/actions';

const completionKey = (orderId: string, insumoName: string) =>
    `${orderId}|${insumoName}`;

const STATUS_ICONS: Record<string, React.ReactNode> = {
    pending: <Clock size={16} />,
    bodega: <Package size={16} />,
    corte: <Scissors size={16} />,
    maquila: <Factory size={16} />,
    impresion: <Printer size={16} />,
    empaque: <PackageCheck size={16} />,
    completed: <CheckCircle2 size={16} />,
    cancelled: <XCircle size={16} />,
};

interface InsumoSummary {
    name: string;
    totalQty: number;
}

function roundQty(n: number): number {
    return Math.round(n * 100) / 100;
}

function aggregateInsumos(items: CartItem[]): InsumoSummary[] {
    const map = new Map<string, number>();
    for (const item of items) {
        if (!item.bom) continue;
        for (const b of item.bom) {
            const key = b.name.trim().toLowerCase();
            map.set(key, (map.get(key) || 0) + b.qty * item.quantity);
        }
    }
    return Array.from(map.entries())
        .map(([name, totalQty]) => ({ name, totalQty: roundQty(totalQty) }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function aggregateInsumosGlobal(orders: Order[]): InsumoSummary[] {
    const allItems = orders.flatMap((o) => o.items);
    return aggregateInsumos(allItems);
}

function ReportMissingForm({
    orderId,
    insumoName,
    requiredQty,
    onClose,
    onSent,
}: {
    orderId: string;
    insumoName: string;
    requiredQty: number;
    onClose: () => void;
    onSent: () => void;
}) {
    const [missingQty, setMissingQty] = useState<string>(String(requiredQty));
    const [notes, setNotes] = useState('');
    const [sending, startSending] = useTransition();

    const handleSubmit = () => {
        const qty = parseFloat(missingQty);
        if (!qty || qty <= 0) return;
        startSending(async () => {
            try {
                await reportMissingInsumoAction(
                    orderId,
                    insumoName,
                    requiredQty,
                    qty,
                    notes || undefined
                );
                onSent();
            } catch {
                alert('Error al reportar faltante');
            }
        });
    };

    return (
        <div className="mt-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-red-700 dark:text-red-300">
                    Reportar faltante: {insumoName}
                </p>
                <button onClick={onClose} className="text-red-400 hover:text-red-600">
                    <X size={14} />
                </button>
            </div>
            <div className="flex gap-2">
                <div className="flex-1">
                    <label className="text-xs text-red-600 dark:text-red-400">Cant. faltante</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={missingQty}
                        onChange={(e) => setMissingQty(e.target.value)}
                        className="w-full px-2 py-1.5 border border-red-200 dark:border-red-800 rounded text-sm bg-white dark:bg-zinc-900 outline-none focus:ring-1 focus:ring-red-400"
                    />
                </div>
                <div className="flex-1">
                    <label className="text-xs text-red-600 dark:text-red-400">Nota (opcional)</label>
                    <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Detalle..."
                        className="w-full px-2 py-1.5 border border-red-200 dark:border-red-800 rounded text-sm bg-white dark:bg-zinc-900 outline-none focus:ring-1 focus:ring-red-400"
                    />
                </div>
            </div>
            <button
                onClick={handleSubmit}
                disabled={sending || !parseFloat(missingQty)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
                {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Enviar reporte
            </button>
        </div>
    );
}

function ImagePreviewModal({
    src,
    alt,
    onClose,
}: {
    src: string;
    alt: string;
    onClose: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={onClose}
        >
            <div
                className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden max-w-lg w-full"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
                >
                    <X size={18} />
                </button>
                <img
                    src={src}
                    alt={alt}
                    className="w-full h-auto max-h-[70vh] object-contain"
                />
                <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800">
                    <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">
                        {alt}
                    </p>
                </div>
            </div>
        </div>
    );
}

function OrderCard({
    order,
    onStatusChange,
    isPending,
    completedInsumos,
    onToggleInsumo,
}: {
    order: Order;
    onStatusChange: (uuid: string, status: OrderStatus) => void;
    isPending: boolean;
    completedInsumos: Set<string>;
    onToggleInsumo: (orderId: string, insumoName: string, completed: boolean) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [reportingInsumo, setReportingInsumo] = useState<string | null>(null);
    const [sentReports, setSentReports] = useState<Set<string>>(new Set());
    const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
    const status = (order.status as OrderStatus) || 'pending';
    const statusOption = ORDER_STATUS_OPTIONS.find((s) => s.value === status);
    const insumos = aggregateInsumos(order.items);
    const totalPieces = order.items.reduce((s, i) => s + i.quantity, 0);

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
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
                    <select
                        value={status}
                        onChange={(e) =>
                            order.uuid && onStatusChange(order.uuid, e.target.value as OrderStatus)
                        }
                        disabled={!order.uuid || isPending}
                        className={`py-1 px-3 rounded-full text-xs font-bold border-none outline-none cursor-pointer shrink-0 ${statusOption?.color || 'bg-gray-100 text-gray-800'}`}
                    >
                        {ORDER_STATUS_OPTIONS.map((opt) => (
                            <option
                                key={opt.value}
                                value={opt.value}
                                className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100"
                            >
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-3 mt-3">
                    <span className="bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-xs font-bold px-2 py-1 rounded-full">
                        {totalPieces} pzas
                    </span>
                    <span className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 text-xs font-bold px-2 py-1 rounded-full">
                        {order.items.length} líneas
                    </span>
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
                                    {item.imageUrl ? (
                                        <button
                                            onClick={() =>
                                                setPreviewImage({
                                                    src: item.imageUrl!,
                                                    alt: item.productName,
                                                })
                                            }
                                            className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-zinc-700 hover:ring-2 hover:ring-orange-400 transition-all cursor-pointer"
                                        >
                                            <img
                                                src={item.imageUrl}
                                                alt={item.productName}
                                                className="w-full h-full object-cover"
                                            />
                                        </button>
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-zinc-700 shrink-0 flex items-center justify-center">
                                            <ImageIcon size={16} className="text-gray-400 dark:text-zinc-500" />
                                        </div>
                                    )}
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
                                        const isCompleted =
                                            !!order.uuid &&
                                            completedInsumos.has(completionKey(order.uuid, ins.name));
                                        return (
                                            <div key={ins.name}>
                                                <div
                                                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                                                        isCompleted
                                                            ? 'bg-green-50 dark:bg-green-950/30'
                                                            : 'bg-purple-50 dark:bg-purple-950/30'
                                                    }`}
                                                >
                                                    <span
                                                        className={`truncate ${
                                                            isCompleted
                                                                ? 'text-green-800 dark:text-green-300 line-through'
                                                                : 'text-purple-900 dark:text-purple-200'
                                                        }`}
                                                    >
                                                        {ins.name}
                                                    </span>
                                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                                        <span
                                                            className={`font-bold ${
                                                                isCompleted
                                                                    ? 'text-green-700 dark:text-green-300'
                                                                    : 'text-purple-700 dark:text-purple-300'
                                                            }`}
                                                        >
                                                            {ins.totalQty}
                                                        </span>
                                                        {order.uuid && (
                                                            <button
                                                                onClick={() =>
                                                                    onToggleInsumo(order.uuid!, ins.name, !isCompleted)
                                                                }
                                                                className={`rounded-full p-1 transition-colors ${
                                                                    isCompleted
                                                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                                                        : 'bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:border-green-500 hover:text-green-600'
                                                                }`}
                                                                title={isCompleted ? 'Marcar como pendiente' : 'Marcar como completo'}
                                                            >
                                                                <Check size={12} strokeWidth={3} />
                                                            </button>
                                                        )}
                                                        {sentReports.has(ins.name) ? (
                                                            <span className="text-red-500 dark:text-red-400" title="Faltante reportado">
                                                                <CheckCircle2 size={14} />
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() =>
                                                                    setReportingInsumo(
                                                                        reportingInsumo === ins.name ? null : ins.name
                                                                    )
                                                                }
                                                                className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300 transition-colors"
                                                                title="Reportar faltante"
                                                            >
                                                                <AlertTriangle size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {reportingInsumo === ins.name && order.uuid && (
                                                    <ReportMissingForm
                                                        orderId={order.uuid}
                                                        insumoName={ins.name}
                                                        requiredQty={ins.totalQty}
                                                        onClose={() => setReportingInsumo(null)}
                                                        onSent={() => {
                                                            setReportingInsumo(null);
                                                            setSentReports((prev) =>
                                                                new Set(prev).add(ins.name)
                                                            );
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {previewImage && (
                <ImagePreviewModal
                    src={previewImage.src}
                    alt={previewImage.alt}
                    onClose={() => setPreviewImage(null)}
                />
            )}
        </div>
    );
}

export function OperatorBoard({
    initialOrders,
    initialCompletions,
}: {
    initialOrders: Order[];
    initialCompletions: InsumoCompletion[];
}) {
    const [orders, setOrders] = useState<Order[]>(initialOrders);
    const [completedInsumos, setCompletedInsumos] = useState<Set<string>>(
        () => new Set(initialCompletions.map((c) => completionKey(c.orderId, c.insumoName)))
    );
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<OrderStatus | 'all'>('all');
    const [showGlobalInsumos, setShowGlobalInsumos] = useState(false);
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    const handleUpdateStatus = (uuid: string, newStatus: OrderStatus) => {
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

    const handleToggleInsumo = (
        orderId: string,
        insumoName: string,
        completed: boolean
    ) => {
        const key = completionKey(orderId, insumoName);
        setCompletedInsumos((prev) => {
            const next = new Set(prev);
            if (completed) next.add(key);
            else next.delete(key);
            return next;
        });
        startTransition(async () => {
            try {
                await toggleInsumoCompleteAction(orderId, insumoName, completed);
            } catch {
                alert('Error al actualizar insumo');
                setCompletedInsumos((prev) => {
                    const rollback = new Set(prev);
                    if (completed) rollback.delete(key);
                    else rollback.add(key);
                    return rollback;
                });
            }
        });
    };

    const filtered = orders.filter((o) => {
        if (activeFilter !== 'all' && o.status !== activeFilter) return false;
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            o.customerName?.toLowerCase().includes(term) ||
            o.companyName?.toLowerCase().includes(term) ||
            o.id?.toLowerCase().includes(term)
        );
    });

    const statusCounts = orders.reduce(
        (acc, o) => {
            const s = (o.status as OrderStatus) || 'pending';
            acc[s] = (acc[s] || 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    const activeOrders = filtered.filter(
        (o) => o.status !== 'completed' && o.status !== 'cancelled'
    );
    const globalInsumos = aggregateInsumosGlobal(
        activeFilter === 'all' ? activeOrders : filtered
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                        Operador — Insumos
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Seguimiento de pedidos y preparación de insumos.
                    </p>
                </div>
                <button
                    onClick={() => router.refresh()}
                    className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                >
                    <RefreshCw size={20} className={pending ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Status filter chips */}
            <div className="flex flex-wrap gap-2 mb-4">
                <button
                    onClick={() => setActiveFilter('all')}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
                        activeFilter === 'all'
                            ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-md'
                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                    }`}
                >
                    <Filter size={14} />
                    Todos ({orders.length})
                </button>
                {ORDER_STATUS_OPTIONS.map((opt) => {
                    const count = statusCounts[opt.value] || 0;
                    if (count === 0) return null;
                    return (
                        <button
                            key={opt.value}
                            onClick={() =>
                                setActiveFilter(
                                    activeFilter === opt.value ? 'all' : opt.value
                                )
                            }
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
                                activeFilter === opt.value
                                    ? 'ring-2 ring-offset-1 ring-orange-500 dark:ring-offset-zinc-950 shadow-md ' +
                                      opt.color
                                    : opt.color + ' opacity-80 hover:opacity-100'
                            }`}
                        >
                            {STATUS_ICONS[opt.value]}
                            {opt.label} ({count})
                        </button>
                    );
                })}
            </div>

            {/* Search bar */}
            <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm mb-4">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-2.5 text-gray-400 dark:text-zinc-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por orden, empresa o cliente..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Global insumo summary toggle */}
            {globalInsumos.length > 0 && (
                <div className="mb-4">
                    <button
                        onClick={() => setShowGlobalInsumos(!showGlobalInsumos)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors shadow-sm"
                    >
                        <Package size={16} />
                        Resumen de insumos ({globalInsumos.length})
                        {showGlobalInsumos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {showGlobalInsumos && (
                        <div className="mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-purple-200 dark:border-purple-900/50 p-4">
                            <h3 className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide mb-3">
                                {activeFilter === 'all'
                                    ? 'Insumos totales (pedidos activos)'
                                    : `Insumos — ${ORDER_STATUS_OPTIONS.find((o) => o.value === activeFilter)?.label || ''}`}
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {globalInsumos.map((ins) => (
                                    <div
                                        key={ins.name}
                                        className="flex items-center justify-between bg-purple-50 dark:bg-purple-950/30 rounded-lg px-3 py-2.5"
                                    >
                                        <span className="text-sm text-purple-900 dark:text-purple-200 truncate">
                                            {ins.name}
                                        </span>
                                        <span className="font-bold text-purple-700 dark:text-purple-300 text-sm shrink-0 ml-2">
                                            {ins.totalQty}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Order cards grid */}
            {filtered.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400">
                    No se encontraron pedidos.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map((order) => (
                        <OrderCard
                            key={order.uuid || order.id}
                            order={order}
                            onStatusChange={handleUpdateStatus}
                            isPending={pending}
                            completedInsumos={completedInsumos}
                            onToggleInsumo={handleToggleInsumo}
                        />
                    ))}
                </div>
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
