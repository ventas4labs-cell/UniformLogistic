'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Scissors,
    RefreshCw,
    Loader2,
    ChevronDown,
    ChevronUp,
    Layers
} from 'lucide-react';
import type { Order } from '@/lib/types';
import { aggregateCutLines, parseColors } from '@/lib/stage-utils';
import { StageCompleteToggle } from '@/components/admin/stage-complete-toggle';
import type { StageTab } from '@/components/admin/stage-tab-bar';
import { StageBoardFilters } from '@/components/admin/stage-board-filters';
import { CollapsibleSearch } from '@/components/admin/collapsible-search';

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
                                    <ColorSwatches
                                        colors={
                                            line.color === '—'
                                                ? []
                                                : line.color.split(' / ')
                                        }
                                    />
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

// Base color hex by Spanish color name (lowercase keys). Falls back to
// a neutral gray for unrecognized names.
const COLOR_HEX: Record<string, string> = {
    azul: '#2563eb',
    rojo: '#dc2626',
    verde: '#16a34a',
    amarillo: '#facc15',
    negro: '#000000',
    blanco: '#ffffff',
    gris: '#9ca3af',
    beige: '#d4b896',
    café: '#7c4a1e',
    cafe: '#7c4a1e',
    rosa: '#f472b6',
    naranja: '#f97316',
    morado: '#9333ea',
    celeste: '#7dd3fc',
    turquesa: '#14b8a6',
    kaki: '#8a8456',
    caqui: '#8a8456',
    crema: '#fef3c7',
    marino: '#1e3a8a',
    vino: '#7f1d1d',
    oliva: '#65a30d',
    mostaza: '#ca8a04',
    coral: '#fb7185',
    menta: '#6ee7b7',
    lila: '#c084fc',
    violeta: '#7c3aed'
};

// Darken (amount < 0) or lighten (amount > 0) a #rrggbb hex.
function shadeHex(hex: string, amount: number): string {
    const m = hex.replace('#', '');
    if (m.length !== 6) return hex;
    const num = parseInt(m, 16);
    const adj = (c: number) =>
        amount < 0
            ? Math.round(c * (1 + amount))
            : Math.round(c + (255 - c) * amount);
    const r = adj((num >> 16) & 0xff);
    const g = adj((num >> 8) & 0xff);
    const b = adj(num & 0xff);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Heuristic color swatch. Accepts labels like "Azul oscuro" / "Negro";
// picks the base color word and applies a claro/oscuro shade. Falls
// back to neutral gray when no color word is recognized.
function colorSwatch(label: string): string {
    const parts = label.toLowerCase().split(/\s+/);
    const base = parts.find((p) => COLOR_HEX[p]);
    let hex = base ? COLOR_HEX[base] : '#d1d5db';
    if (parts.some((p) => p.startsWith('oscur'))) hex = shadeHex(hex, -0.35);
    else if (parts.some((p) => p.startsWith('clar'))) hex = shadeHex(hex, 0.35);
    return hex;
}

// Renders one swatch + label per color. Telas with two fabric segments
// (e.g. "Army azul oscuro / Speed dry negro") surface both colors.
function ColorSwatches({ colors }: { colors: string[] }) {
    if (colors.length === 0) {
        return <span className="text-gray-400 dark:text-zinc-500">—</span>;
    }
    return (
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            {colors.map((c, i) => (
                <span key={`${c}-${i}`} className="inline-flex items-center gap-1.5">
                    <span
                        className="w-3 h-3 rounded-full border border-gray-300 dark:border-zinc-600 shrink-0"
                        style={{ backgroundColor: colorSwatch(c) }}
                    />
                    <span className="text-gray-700 dark:text-zinc-300 whitespace-nowrap">
                        {c}
                    </span>
                </span>
            ))}
        </span>
    );
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
                        orderRef={order.id}
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
                                const colors = parseColors(item.fabricType);
                                return (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                                        <td className="px-4 py-2 text-gray-900 dark:text-zinc-100">
                                            {item.productName}
                                        </td>
                                        <td className="px-4 py-2 text-gray-600 dark:text-zinc-400">
                                            {item.fabricType || '—'}
                                        </td>
                                        <td className="px-4 py-2">
                                            <ColorSwatches colors={colors} />
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
    const [companyFilter, setCompanyFilter] = useState<string>('all');
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
        if (companyFilter !== 'all' && o.companyName !== companyFilter) return false;
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
                <div className="flex items-center gap-2">
                    <CollapsibleSearch
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Buscar por orden, empresa o cliente…"
                    />
                    <StageBoardFilters
                        orders={orders}
                        counts={counts}
                        tab={tab}
                        setTab={setTab}
                        companyFilter={companyFilter}
                        setCompanyFilter={setCompanyFilter}
                    />
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
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4 items-start">
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
