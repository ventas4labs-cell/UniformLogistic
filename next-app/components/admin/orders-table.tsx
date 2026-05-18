'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Download, Search, RefreshCw, Loader2, Eye, Receipt } from 'lucide-react';
import type { Order } from '@/lib/types';
import { ORDER_STATUS_OPTIONS, OrderStatus } from '@/lib/services/orders';
import { updateOrderStatusAction } from '@/app/(admin)/admin/orders/actions';
import { FacturaModal } from '@/components/admin/factura-modal';
import { useRouter } from 'next/navigation';

export function OrdersTable({ initialOrders }: { initialOrders: Order[] }) {
    const [orders, setOrders] = useState<Order[]>(initialOrders);
    const [searchTerm, setSearchTerm] = useState('');
    const [pending, startTransition] = useTransition();
    const [facturaOrder, setFacturaOrder] = useState<Order | null>(null);
    const router = useRouter();

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

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-200 dark:border-zinc-800">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Ref</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Cliente</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Empresa</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Fecha</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Estado</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Artículos</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-gray-500 dark:text-zinc-400">
                                    No se encontraron pedidos.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((order) => {
                                const status = (order.status as OrderStatus) || 'pending';
                                const statusOption = ORDER_STATUS_OPTIONS.find((s) => s.value === status);
                                return (
                                    <tr key={order.uuid || order.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                        <td className="p-4 font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                                            {order.id}
                                        </td>
                                        <td className="p-4 font-medium text-gray-900 dark:text-zinc-100">
                                            {order.customerName || '—'}
                                        </td>
                                        <td className="p-4 text-gray-600 dark:text-zinc-400">{order.companyName || '—'}</td>
                                        <td className="p-4 text-gray-500 dark:text-zinc-400 text-sm">
                                            {new Date(order.dateCreated).toLocaleDateString()}
                                        </td>
                                        <td className="p-4">
                                            <select
                                                value={status}
                                                onChange={(e) =>
                                                    handleUpdateStatus(order.uuid, e.target.value as OrderStatus)
                                                }
                                                disabled={!order.uuid || pending}
                                                className={`py-1 px-3 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${statusOption?.color || 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200'}`}
                                            >
                                                {ORDER_STATUS_OPTIONS.map((option) => (
                                                    <option
                                                        key={option.value}
                                                        value={option.value}
                                                        className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100"
                                                    >
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-xs font-bold px-2 py-1 rounded-full">
                                                {totalPieces(order)} pzas
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handlePreviewPdf(order)}
                                                    className="text-gray-600 dark:text-zinc-400 hover:text-orange-600 font-bold text-sm flex items-center gap-1 bg-gray-50 dark:bg-zinc-900/60 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800 hover:border-orange-200 hover:bg-orange-50 transition-colors"
                                                >
                                                    <Eye size={16} /> Ver
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadPdf(order)}
                                                    className="text-orange-600 dark:text-orange-400 hover:text-orange-800 font-bold text-sm flex items-center gap-1 bg-orange-50 dark:bg-orange-950/30 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-900/50 transition-colors"
                                                >
                                                    <Download size={16} /> PDF
                                                </button>
                                                <button
                                                    onClick={() => setFacturaOrder(order)}
                                                    className="text-green-700 dark:text-green-300 hover:text-green-900 font-bold text-sm flex items-center gap-1 bg-green-50 dark:bg-green-950/30 px-3 py-1.5 rounded-lg border border-green-100 dark:border-green-900/50 transition-colors"
                                                    title="Generar factura electrónica"
                                                >
                                                    <Receipt size={16} /> Factura
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        {pending && (
                            <tr>
                                <td colSpan={7} className="p-2 text-center text-gray-400 dark:text-zinc-500 text-xs">
                                    <Loader2 className="animate-spin inline mr-2" size={12} />
                                    Actualizando...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {facturaOrder && (
                <FacturaModal order={facturaOrder} onClose={() => setFacturaOrder(null)} />
            )}
        </div>
    );
}
