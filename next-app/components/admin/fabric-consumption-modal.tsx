'use client';

import { useMemo, useState } from 'react';
import { X, Ruler, Download, ChevronDown, ChevronRight } from 'lucide-react';
import type { Order } from '@/lib/types';
import type { CorteFabricReport } from '@/lib/services/corte-fabric-reports';
import {
    UNSPECIFIED_FABRIC_LABEL,
    filterFabricLines,
    groupFabricLines,
    type FabricPeriod,
    type FabricUsageLine,
    type FabricUsageGroup
} from '@/lib/corte-fabric';

// ─── Consumo de tela (Pedidos) ───────────────────────────────────────
// Consolidated view of what Corte reported spending across orders.
// Totals are grouped by tela AND unit — an estimate in metros says
// nothing about a figure in kilos, so they never share a row. Each
// group expands into the per-order lines behind it.

const PERIODS: { key: FabricPeriod; label: string }[] = [
    { key: 'month', label: 'Este mes' },
    { key: 'last-month', label: 'Mes pasado' },
    { key: '3m', label: 'Últimos 3 meses' },
    { key: 'all', label: 'Todo' }
];

const fmt = (n: number) =>
    n.toLocaleString('es-CR', { maximumFractionDigits: 2 });

export function FabricConsumptionModal({
    orders,
    reportsByOrder,
    onClose
}: {
    orders: Order[];
    reportsByOrder: Record<string, CorteFabricReport[]>;
    onClose: () => void;
}) {
    const [period, setPeriod] = useState<FabricPeriod>('month');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    // Flatten every reported line, attaching the order it belongs to.
    const allLines = useMemo<FabricUsageLine[]>(() => {
        const byUuid = new Map(orders.filter((o) => o.uuid).map((o) => [o.uuid as string, o]));
        const out: FabricUsageLine[] = [];
        for (const [orderUuid, reports] of Object.entries(reportsByOrder)) {
            const order = byUuid.get(orderUuid);
            if (!order) continue;
            for (const r of reports) {
                out.push({
                    orderRef: order.id,
                    orderUuid,
                    company: order.companyName || order.customerName || '—',
                    reportedAt: r.reportedAt,
                    fabricType: r.fabricType,
                    label: r.fabricType || UNSPECIFIED_FABRIC_LABEL,
                    used: r.qtyUsed,
                    unit: r.unit,
                    expected: r.expectedQty,
                    notes: r.notes
                });
            }
        }
        return out;
    }, [orders, reportsByOrder]);

    // Filtered by when corte reported the cut — that's when the tela was
    // actually consumed, not when the order was placed.
    const lines = useMemo(
        () => filterFabricLines(allLines, period),
        [allLines, period]
    );

    const groups = useMemo<FabricUsageGroup[]>(
        () => groupFabricLines(lines),
        [lines]
    );

    const totalOrders = new Set(lines.map((l) => l.orderUuid)).size;

    const toggle = (key: string) =>
        setExpanded((prev) => {
            const n = new Set(prev);
            if (n.has(key)) n.delete(key);
            else n.add(key);
            return n;
        });

    const handleExport = async () => {
        const { generateFabricConsumptionPDF } = await import('@/lib/pdf-service');
        const periodLabel =
            PERIODS.find((p) => p.key === period)?.label || 'Todo';
        const pdf = generateFabricConsumptionPDF(
            groups.map((g) => ({
                fabricType: g.label,
                unit: g.unit,
                orders: g.orders,
                used: g.used,
                expected: g.expected
            })),
            lines
                .slice()
                .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
                .map((l) => ({
                    orderRef: l.orderRef,
                    company: l.company,
                    date: new Date(l.reportedAt).toLocaleDateString('es-CR'),
                    fabricType: l.label,
                    used: l.used,
                    unit: l.unit,
                    expected: l.expected,
                    notes: l.notes
                })),
            periodLabel
        );
        pdf.save(`CONSUMO_TELA_${period}.pdf`);
    };

    const diffBadge = (used: number, expected: number | null, unit: string) => {
        if (expected === null || expected === 0) return null;
        const d = used - expected;
        const pct = Math.round((d / expected) * 100);
        return (
            <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    d > 0.005
                        ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                        : d < -0.005
                            ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300'
                }`}
            >
                {d > 0 ? '+' : ''}
                {fmt(d)} {unit} ({d > 0 ? '+' : ''}
                {pct}%)
            </span>
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-4xl my-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
                    <Ruler size={20} className="text-orange-600 dark:text-orange-400" />
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                            Consumo de tela
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-400">
                            Reportado por Corte · {totalOrders} pedido
                            {totalOrders === 1 ? '' : 's'}
                        </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={groups.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-950/40 hover:bg-orange-200 dark:hover:bg-orange-900/50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Download size={14} /> PDF
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                            aria-label="Cerrar"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap px-5 py-3 border-b border-gray-100 dark:border-zinc-800">
                    {PERIODS.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => setPeriod(p.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                period === p.key
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <div className="p-5">
                    {groups.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-10">
                            Sin consumo reportado en este período. Corte registra la
                            tela gastada desde su tablero.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {groups.map((g) => {
                                const open = expanded.has(g.key);
                                return (
                                    <div
                                        key={g.key}
                                        className="rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => toggle(g.key)}
                                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors"
                                        >
                                            <span className="text-gray-400 dark:text-zinc-500 shrink-0">
                                                {open ? (
                                                    <ChevronDown size={15} />
                                                ) : (
                                                    <ChevronRight size={15} />
                                                )}
                                            </span>
                                            <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100 truncate">
                                                {g.label}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-zinc-400 shrink-0">
                                                {g.orders} pedido{g.orders === 1 ? '' : 's'}
                                            </span>
                                            <span className="ml-auto flex items-center gap-2 shrink-0">
                                                {g.expected !== null && (
                                                    <span className="text-xs text-gray-500 dark:text-zinc-400 hidden sm:inline">
                                                        esp. {fmt(g.expected)} {g.unit}
                                                    </span>
                                                )}
                                                {diffBadge(g.used, g.expected, g.unit)}
                                                <span className="font-mono font-bold text-sm text-gray-900 dark:text-zinc-100">
                                                    {fmt(g.used)} {g.unit}
                                                </span>
                                            </span>
                                        </button>

                                        {open && (
                                            <div className="border-t border-gray-100 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
                                                {g.lines.map((l, i) => (
                                                    <div
                                                        key={`${l.orderUuid}-${i}`}
                                                        className="flex items-center gap-3 px-3 py-2 text-sm bg-gray-50/60 dark:bg-zinc-800/30"
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-baseline gap-2 flex-wrap">
                                                                <span className="font-semibold text-gray-900 dark:text-zinc-100">
                                                                    {l.orderRef}
                                                                </span>
                                                                <span className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                                                                    {l.company}
                                                                </span>
                                                                <span className="text-[11px] text-gray-400 dark:text-zinc-500">
                                                                    {new Date(
                                                                        l.reportedAt
                                                                    ).toLocaleDateString('es-CR')}
                                                                </span>
                                                            </div>
                                                            {l.notes && (
                                                                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                                                                    {l.notes}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {diffBadge(l.used, l.expected, l.unit)}
                                                        <span className="font-mono font-bold text-sm text-gray-700 dark:text-zinc-200 shrink-0">
                                                            {fmt(l.used)} {l.unit}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
