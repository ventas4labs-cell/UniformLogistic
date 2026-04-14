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
                    <h2 className="text-2xl font-bold text-gray-900">Pedidos</h2>
                    <p className="text-gray-500 text-sm">Logística y control de producción.</p>
                </div>
                <Link
                    href="/catalog"
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md flex items-center gap-2"
                >
                    + Nuevo Pedido
                </Link>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex justify-between items-center">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
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
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                    <RefreshCw size={20} className={pending ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600">Ref</th>
                            <th className="p-4 font-semibold text-gray-600">Cliente</th>
                            <th className="p-4 font-semibold text-gray-600">Empresa</th>
                            <th className="p-4 font-semibold text-gray-600">Fecha</th>
                            <th className="p-4 font-semibold text-gray-600">Estado</th>
                            <th className="p-4 font-semibold text-gray-600">Artículos</th>
                            <th className="p-4 font-semibold text-gray-600 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-gray-500">
                                    No se encontraron pedidos.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((order) => {
                                const status = (order.status as OrderStatus) || 'pending';
                                const statusOption = ORDER_STATUS_OPTIONS.find((s) => s.value === status);
                                return (
                                    <tr key={order.uuid || order.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-mono text-sm font-bold text-orange-600">
                                            {order.id}
                                        </td>
                                        <td className="p-4 font-medium text-gray-900">
                                            {order.customerName || '—'}
                                        </td>
                                        <td className="p-4 text-gray-600">{order.companyName || '—'}</td>
                                        <td className="p-4 text-gray-500 text-sm">
                                            {new Date(order.dateCreated).toLocaleDateString()}
                                        </td>
                                        <td className="p-4">
                                            <select
                                                value={status}
                                                onChange={(e) =>
                                                    handleUpdateStatus(order.uuid, e.target.value as OrderStatus)
                                                }
                                                disabled={!order.uuid || pending}
                                                className={`py-1 px-3 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${statusOption?.color || 'bg-gray-100 text-gray-800'}`}
                                            >
                                                {ORDER_STATUS_OPTIONS.map((option) => (
                                                    <option
                                                        key={option.value}
                                                        value={option.value}
                                                        className="bg-white text-gray-900"
                                                    >
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded-full">
                                                {totalPieces(order)} pzas
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handlePreviewPdf(order)}
                                                    className="text-gray-600 hover:text-orange-600 font-bold text-sm flex items-center gap-1 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-orange-200 hover:bg-orange-50 transition-colors"
                                                >
                                                    <Eye size={16} /> Ver
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadPdf(order)}
                                                    className="text-orange-600 hover:text-orange-800 font-bold text-sm flex items-center gap-1 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 transition-colors"
                                                >
                                                    <Download size={16} /> PDF
                                                </button>
                                                <button
                                                    onClick={() => setFacturaOrder(order)}
                                                    className="text-green-700 hover:text-green-900 font-bold text-sm flex items-center gap-1 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100 transition-colors"
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
                                <td colSpan={7} className="p-2 text-center text-gray-400 text-xs">
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
