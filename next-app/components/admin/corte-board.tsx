'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Scissors,
    Search,
    RefreshCw,
    Loader2,
    ChevronDown,
    ChevronUp,
    Layers,
    BellRing,
    CheckCircle2
} from 'lucide-react';
import type { Order } from '@/lib/types';
import { ORDER_STATUS_OPTIONS, OrderStatus } from '@/lib/services/orders';
import { aggregateCutLines, parseColor } from '@/lib/stage-utils';
import {
    updateStageStatusAction,
    notifyStageFinishedAction
} from '@/app/(admin)/admin/_stage-actions';

function CutSummary({ orders }: { orders: Order[] }) {
    const lines = useMemo(() => aggregateCutLines(orders), [orders]);
    if (lines.length === 0) return null;

    const grandTotal = lines.reduce((s, l) => s + l.totalQty, 0);

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-purple-200 dark:border-purple-900/50 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Layers size={18} className="text-purple-600 dark:text-purple-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-zinc-300">
                        Plan de Corte Consolidado
                    </h3>
                </div>
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/50 px-3 py-1 rounded-full">
                    {grandTotal} pzas totales
                </span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-200 dark:border-zinc-800">
                        <tr>
                            <th className="text-left p-3 font-semibold text-gray-600 dark:text-zinc-400">
                                Tela
                            </th>
                            <th className="text-left p-3 font-semibold text-gray-600 dark:text-zinc-400">
                                Color
                            </th>
                            <th className="text-left p-3 font-semibold text-gray-600 dark:text-zinc-400">
                                Talla
                            </th>
                            <th className="text-right p-3 font-semibold text-gray-600 dark:text-zinc-400">
                                Cant.
                            </th>
                            <th className="text-left p-3 font-semibold text-gray-600 dark:text-zinc-400">
                                Órdenes
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {lines.map((line, idx) => (
                            <tr
                                key={`${line.fabric}-${line.color}-${line.size}-${idx}`}
                                className="hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                            >
                                <td className="p-3 text-gray-900 dark:text-zinc-100">
                                    {line.fabric}
                                </td>
                                <td className="p-3">
                                    <span className="inline-flex items-center gap-1.5">
                                        <span
                                            className="w-3 h-3 rounded-full border border-gray-300 dark:border-zinc-600"
                                            style={{
                                                backgroundColor: colorSwatch(line.color)
                                            }}
                                        />
                                        <span className="text-gray-700 dark:text-zinc-300">
                                            {line.color}
                                        </span>
                                    </span>
                                </td>
                                <td className="p-3 font-mono text-gray-700 dark:text-zinc-300">
                                    {line.size}
                                </td>
                                <td className="p-3 text-right font-bold text-purple-700 dark:text-purple-300">
                                    {line.totalQty}
                                </td>
                                <td className="p-3 text-xs text-gray-500 dark:text-zinc-400">
                                    {line.orderRefs.join(', ')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Heuristic color swatch. Maps common Spanish color names to a CSS
// color. Falls back to a neutral gray when we don't recognize it.
function colorSwatch(color: string): string {
    const map: Record<string, string> = {
        Azul: '#2563eb',
        Rojo: '#dc2626',
        Verde: '#16a34a',
        Amarillo: '#facc15',
        Negro: '#000000',
        Blanco: '#ffffff',
        Gris: '#9ca3af',
        Beige: '#d4b896',
        Café: '#7c4a1e',
        Cafe: '#7c4a1e',
        Rosa: '#f472b6',
        Naranja: '#f97316',
        Morado: '#9333ea',
        Celeste: '#7dd3fc',
        Turquesa: '#14b8a6',
        Kaki: '#8a8456',
        Caqui: '#8a8456',
        Crema: '#fef3c7',
        Marino: '#1e3a8a',
        Vino: '#7f1d1d',
        Oliva: '#65a30d',
        Mostaza: '#ca8a04',
        Coral: '#fb7185',
        Menta: '#6ee7b7',
        Lila: '#c084fc',
        Violeta: '#7c3aed'
    };
    return map[color] || '#d1d5db';
}

function OrderCard({
    order,
    onStatusChange,
    onNotifyFinished,
    notified,
    isPending
}: {
    order: Order;
    onStatusChange: (uuid: string, status: OrderStatus) => void;
    onNotifyFinished: (uuid: string) => void;
    notified: boolean;
    isPending: boolean;
}) {
    const [expanded, setExpanded] = useState(true);
    const status = (order.status as OrderStatus) || 'corte';
    const statusOption = ORDER_STATUS_OPTIONS.find((s) => s.value === status);
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
                </div>
            </div>

            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-1 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 transition-colors"
            >
                {expanded ? (
                    <>
                        Ocultar piezas <ChevronUp size={14} />
                    </>
                ) : (
                    <>
                        Ver piezas <ChevronDown size={14} />
                    </>
                )}
            </button>

            <div className="border-t border-gray-100 dark:border-zinc-800 p-3 bg-gray-50/60 dark:bg-zinc-900/40">
                <button
                    onClick={() => order.uuid && onNotifyFinished(order.uuid)}
                    disabled={!order.uuid || isPending || notified}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm ${
                        notified
                            ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 cursor-default'
                            : 'bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-zinc-700'
                    }`}
                >
                    {notified ? (
                        <>
                            <CheckCircle2 size={16} /> Notificación enviada
                        </>
                    ) : (
                        <>
                            <BellRing size={16} /> Notificar corte terminado
                        </>
                    )}
                </button>
            </div>

            {expanded && (
                <div className="border-t border-gray-100 dark:border-zinc-800 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-900/60">
                            <tr>
                                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-zinc-400 text-xs">
                                    Producto
                                </th>
                                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-zinc-400 text-xs">
                                    Tela
                                </th>
                                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-zinc-400 text-xs">
                                    Color
                                </th>
                                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-zinc-400 text-xs">
                                    Talla
                                </th>
                                <th className="text-right px-4 py-2 font-semibold text-gray-600 dark:text-zinc-400 text-xs">
                                    Cant.
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {order.items.map((item, idx) => {
                                const color = parseColor(item.productName) || '—';
                                return (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                                        <td className="px-4 py-2 text-gray-900 dark:text-zinc-100">
                                            {item.productName}
                                        </td>
                                        <td className="px-4 py-2 text-gray-600 dark:text-zinc-400">
                                            {item.fabricType || '—'}
                                        </td>
                                        <td className="px-4 py-2">
                                            <span className="inline-flex items-center gap-1.5">
                                                <span
                                                    className="w-3 h-3 rounded-full border border-gray-300 dark:border-zinc-600"
                                                    style={{ backgroundColor: colorSwatch(color) }}
                                                />
                                                <span className="text-gray-700 dark:text-zinc-300">
                                                    {color}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 font-mono text-gray-700 dark:text-zinc-300">
                                            {item.selection.size || '—'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-zinc-100">
                                            {item.quantity}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export function CorteBoard({
    initialOrders,
    initialNotifiedOrderIds
}: {
    initialOrders: Order[];
    initialNotifiedOrderIds: string[];
}) {
    const [orders, setOrders] = useState<Order[]>(initialOrders);
    const [notifiedOrderIds, setNotifiedOrderIds] = useState<Set<string>>(
        () => new Set(initialNotifiedOrderIds)
    );
    const [searchTerm, setSearchTerm] = useState('');
    const [pending, startTransition] = useTransition();
    const [showSummary, setShowSummary] = useState(true);
    const router = useRouter();

    const handleNotifyFinished = (uuid: string) => {
        // Optimistically mark as notified
        setNotifiedOrderIds((prev) => new Set(prev).add(uuid));
        startTransition(async () => {
            try {
                await notifyStageFinishedAction(uuid, 'corte', 'Corte terminado');
            } catch {
                alert('Error al enviar notificación');
                setNotifiedOrderIds((prev) => {
                    const next = new Set(prev);
                    next.delete(uuid);
                    return next;
                });
            }
        });
    };

    const handleUpdateStatus = (uuid: string, newStatus: OrderStatus) => {
        // Optimistic remove if the order moves out of corte
        if (newStatus !== 'corte') {
            setOrders((prev) => prev.filter((o) => o.uuid !== uuid));
        } else {
            setOrders((prev) =>
                prev.map((o) => (o.uuid === uuid ? { ...o, status: newStatus } : o))
            );
        }
        startTransition(async () => {
            try {
                await updateStageStatusAction(uuid, newStatus);
            } catch {
                alert('Error al actualizar estado');
                router.refresh();
            }
        });
    };

    const filtered = orders.filter((o) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            o.customerName?.toLowerCase().includes(term) ||
            o.companyName?.toLowerCase().includes(term) ||
            o.id?.toLowerCase().includes(term)
        );
    });

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <Scissors size={24} className="text-yellow-600 dark:text-yellow-400" />
                        Corte
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Pedidos en corte: planifica las tallas, telas, colores y cantidades.
                    </p>
                </div>
                <button
                    onClick={() => router.refresh()}
                    className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                >
                    <RefreshCw size={20} className={pending ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm mb-4">
                <div className="relative w-full max-w-md">
                    <Search
                        className="absolute left-3 top-2.5 text-gray-400 dark:text-zinc-500"
                        size={18}
                    />
                    <input
                        type="text"
                        placeholder="Buscar por orden, empresa o cliente..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {orders.length > 0 && (
                <div className="mb-4">
                    <button
                        onClick={() => setShowSummary(!showSummary)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors shadow-sm mb-2"
                    >
                        <Layers size={16} />
                        Plan de corte consolidado
                        {showSummary ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {showSummary && <CutSummary orders={filtered} />}
                </div>
            )}

            {filtered.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400">
                    {orders.length === 0
                        ? 'No hay pedidos en corte.'
                        : 'Ninguna orden coincide con la búsqueda.'}
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                    {filtered.map((order) => (
                        <OrderCard
                            key={order.uuid || order.id}
                            order={order}
                            onStatusChange={handleUpdateStatus}
                            onNotifyFinished={handleNotifyFinished}
                            notified={!!order.uuid && notifiedOrderIds.has(order.uuid)}
                            isPending={pending}
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
