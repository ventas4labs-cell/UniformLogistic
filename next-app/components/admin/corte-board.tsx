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
    Layers
} from 'lucide-react';
import type { Order } from '@/lib/types';
import { aggregateCutLines, parseColor } from '@/lib/stage-utils';
import { StageCompleteToggle } from '@/components/admin/stage-complete-toggle';
import { StageTabBar, type StageTab } from '@/components/admin/stage-tab-bar';

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
    isCompleted,
    onLocalCompletionChange
}: {
    order: Order;
    isCompleted: boolean;
    onLocalCompletionChange: (uuid: string, next: boolean) => void;
}) {
    const [expanded, setExpanded] = useState(true);
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
                        stage="corte"
                        isCompleted={isCompleted}
                        onLocalChange={onLocalCompletionChange}
                    />
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
    initialCompletedOrderIds
}: {
    initialOrders: Order[];
    initialCompletedOrderIds: string[];
}) {
    const [orders] = useState<Order[]>(initialOrders);
    const [completed, setCompleted] = useState<Set<string>>(
        () => new Set(initialCompletedOrderIds)
    );
    const [tab, setTab] = useState<StageTab>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [pending] = useTransition();
    const [showSummary, setShowSummary] = useState(true);
    const router = useRouter();

    const handleLocalCompletionChange = (uuid: string, next: boolean) => {
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

            <StageTabBar tab={tab} setTab={setTab} counts={counts} />

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
                    {tab === 'pending'
                        ? 'No hay pedidos pendientes de corte.'
                        : tab === 'done'
                            ? 'Todavía no se ha completado ningún pedido en corte.'
                            : 'No hay pedidos.'}
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                    {filtered.map((order) => (
                        <OrderCard
                            key={order.uuid || order.id}
                            order={order}
                            isCompleted={!!order.uuid && completed.has(order.uuid)}
                            onLocalCompletionChange={handleLocalCompletionChange}
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
