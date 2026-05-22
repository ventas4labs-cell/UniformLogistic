'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Printer, Search, RefreshCw, Loader2 } from 'lucide-react';
import type { Order } from '@/lib/types';
import { ORDER_STATUS_OPTIONS, OrderStatus } from '@/lib/services/orders';
import { updateStageStatusAction } from '@/app/(admin)/admin/_stage-actions';

function OrderCard({
    order,
    onStatusChange,
    isPending
}: {
    order: Order;
    onStatusChange: (uuid: string, status: OrderStatus) => void;
    isPending: boolean;
}) {
    const status = (order.status as OrderStatus) || 'impresion';
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

            <div className="border-t border-gray-100 dark:border-zinc-800">
                <div className="p-4 space-y-1.5">
                    {order.items.map((item, idx) => (
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
            </div>
        </div>
    );
}

export function ImpresionBoard({ initialOrders }: { initialOrders: Order[] }) {
    const [orders, setOrders] = useState<Order[]>(initialOrders);
    const [searchTerm, setSearchTerm] = useState('');
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    const handleUpdateStatus = (uuid: string, newStatus: OrderStatus) => {
        if (newStatus !== 'impresion') {
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
                        <Printer size={24} className="text-pink-600 dark:text-pink-400" />
                        Impresión
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Pedidos en impresión: detalle de orden y artículos.
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
                        className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400">
                    {orders.length === 0
                        ? 'No hay pedidos en impresión.'
                        : 'Ninguna orden coincide con la búsqueda.'}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map((order) => (
                        <OrderCard
                            key={order.uuid || order.id}
                            order={order}
                            onStatusChange={handleUpdateStatus}
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
