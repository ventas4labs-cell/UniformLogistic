'use client';

import { useMemo, useState } from 'react';
import {
    Boxes,
    ChevronDown,
    ChevronRight,
    ImageIcon,
    PackageCheck,
    Warehouse
} from 'lucide-react';
import type { CompanyStockGroup, StockRow } from '@/lib/services/stock';
import { VoiceStockDictate } from '@/components/admin/voice-stock-dictate';
import { CollapsibleSearch } from '@/components/admin/collapsible-search';

// Canonical shirt size order (anything not in this list sorts to the end).
const SHIRT_SIZE_ORDER = [
    'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL'
];

/**
 * Strip the gender prefix from a size string ("H · M" → "M", "M · 2XL" → "2XL").
 * The customer-facing checkout adds the gender; for the admin stock view we
 * only need the canonical size token to sort and label compactly.
 */
function shortSize(s: string): string {
    const parts = s.split('·').map((x) => x.trim());
    return parts[parts.length - 1] || s;
}

function sortSizes(rows: StockRow[]): StockRow[] {
    return [...rows].sort((a, b) => {
        const aShort = shortSize(a.size);
        const bShort = shortSize(b.size);
        // Pants: extract leading number ("C30\"" → 30).
        const aNum = parseInt(aShort.replace(/\D/g, ''), 10);
        const bNum = parseInt(bShort.replace(/\D/g, ''), 10);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        // Shirts: canonical order.
        const ai = SHIRT_SIZE_ORDER.indexOf(aShort.toUpperCase());
        const bi = SHIRT_SIZE_ORDER.indexOf(bShort.toUpperCase());
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return aShort.localeCompare(bShort);
    });
}

interface ProductGroup {
    productId: string;
    productCode: string;
    productName: string;
    productType: 'shirt' | 'pant';
    imageUrl: string | null;
    unitPrice: number | null;
    rows: StockRow[]; // per-size
    totalOnHand: number;
    totalReserved: number;
    totalAvailable: number;
    totalValue: number;
}

function groupByProduct(rows: StockRow[]): ProductGroup[] {
    const map = new Map<string, ProductGroup>();
    for (const r of rows) {
        const g = map.get(r.productId) || {
            productId: r.productId,
            productCode: r.productCode,
            productName: r.productName,
            productType: r.productType,
            imageUrl: r.imageUrl,
            unitPrice: r.unitPrice,
            rows: [],
            totalOnHand: 0,
            totalReserved: 0,
            totalAvailable: 0,
            totalValue: 0
        };
        g.rows.push(r);
        g.totalOnHand += r.quantityOnHand;
        g.totalReserved += r.quantityReserved;
        g.totalAvailable += r.quantityAvailable;
        if (r.unitPrice) g.totalValue += r.unitPrice * r.quantityOnHand;
        map.set(r.productId, g);
    }
    // Sort products by name, sort sizes within each product.
    return Array.from(map.values())
        .map((g) => ({ ...g, rows: sortSizes(g.rows) }))
        .sort((a, b) => a.productName.localeCompare(b.productName, 'es'));
}

type TypeFilter = 'all' | 'shirt' | 'pant';

const fmtCRC = (n: number) =>
    new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: 'CRC',
        maximumFractionDigits: 0
    }).format(n);

const fmtInt = (n: number) => new Intl.NumberFormat('es-CR').format(n);

export function AdminStockBoard({
    groups,
    companies
}: {
    groups: CompanyStockGroup[];
    companies: { id: string; name: string }[];
}) {
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    // Apply type filter to rows within each group (recomputed summary).
    const filteredGroups = useMemo(() => {
        const q = query.trim().toLowerCase();
        return groups
            .map((g) => {
                const filteredRows =
                    typeFilter === 'all'
                        ? g.rows
                        : g.rows.filter((r) => r.productType === typeFilter);
                let totalOnHand = 0;
                let totalAvailable = 0;
                let estimatedValue = 0;
                const productSet = new Set<string>();
                filteredRows.forEach((r) => {
                    totalOnHand += r.quantityOnHand;
                    totalAvailable += r.quantityAvailable;
                    if (r.unitPrice) estimatedValue += r.unitPrice * r.quantityOnHand;
                    productSet.add(r.productId);
                });
                return {
                    ...g,
                    rows: filteredRows,
                    summary: {
                        ...g.summary,
                        skuCount: filteredRows.length,
                        totalOnHand,
                        totalAvailable,
                        estimatedValue,
                        productCount: productSet.size
                    }
                };
            })
            .filter((g) => {
                if (!q) return true;
                return g.company.name.toLowerCase().includes(q);
            })
            .filter((g) => g.rows.length > 0);
    }, [groups, query, typeFilter]);

    // Org-wide totals
    const totals = useMemo(() => {
        let companies = filteredGroups.length;
        let skuCount = 0;
        let totalOnHand = 0;
        let totalAvailable = 0;
        let estimatedValue = 0;
        filteredGroups.forEach((g) => {
            skuCount += g.summary.skuCount;
            totalOnHand += g.summary.totalOnHand;
            totalAvailable += g.summary.totalAvailable;
            estimatedValue += g.summary.estimatedValue;
        });
        return { companies, skuCount, totalOnHand, totalAvailable, estimatedValue };
    }, [filteredGroups]);

    const toggle = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const expandAll = () =>
        setExpanded(new Set(filteredGroups.map((g) => g.company.id)));
    const collapseAll = () => setExpanded(new Set());

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                        Stock global
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Inventario guardado a nombre de cada empresa cliente.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                    <VoiceStockDictate companies={companies} />
                    <button
                        onClick={expandAll}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 font-semibold"
                    >
                        Expandir todo
                    </button>
                    <button
                        onClick={collapseAll}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 font-semibold"
                    >
                        Colapsar
                    </button>
                </div>
            </div>

            {/* KPI strip */}
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                <Kpi
                    label="Empresas"
                    value={fmtInt(totals.companies)}
                    Icon={Warehouse}
                    accent="zinc"
                />
                <Kpi
                    label="SKUs activos"
                    value={fmtInt(totals.skuCount)}
                    Icon={Boxes}
                    accent="blue"
                />
                <Kpi
                    label="Piezas en bodega"
                    value={fmtInt(totals.totalOnHand)}
                    sub={`${fmtInt(totals.totalAvailable)} libres`}
                    Icon={PackageCheck}
                    accent="emerald"
                />
                <Kpi
                    label="Reservadas"
                    value={fmtInt(totals.totalOnHand - totals.totalAvailable)}
                    Icon={Boxes}
                    accent="orange"
                />
                <Kpi
                    label="Valor estimado"
                    value={fmtCRC(totals.estimatedValue)}
                    Icon={Boxes}
                    accent="orange"
                />
            </section>

            {/* Toolbar */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-3 mb-4 flex flex-col sm:flex-row gap-2 sm:items-center border border-gray-200 dark:border-zinc-800">
                <CollapsibleSearch
                    value={query}
                    onChange={setQuery}
                    placeholder="Buscar empresa…"
                    expandedClassName="w-full sm:flex-1"
                />
                <div className="flex gap-1">
                    {(['all', 'shirt', 'pant'] as TypeFilter[]).map((f) => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setTypeFilter(f)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                                typeFilter === f
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                        >
                            {f === 'all' ? 'Todos' : f === 'shirt' ? 'Camisas' : 'Pantalones'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Company groups */}
            {filteredGroups.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-10 text-center text-gray-500 dark:text-zinc-400 shadow-sm border border-gray-200 dark:border-zinc-800">
                    <Boxes size={32} className="mx-auto mb-2 opacity-30" />
                    Sin stock para los filtros seleccionados.
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredGroups.map((g) => {
                        const isOpen = expanded.has(g.company.id);
                        return (
                            <div
                                key={g.company.id}
                                className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden"
                            >
                                <button
                                    type="button"
                                    onClick={() => toggle(g.company.id)}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors text-left"
                                >
                                    {isOpen ? (
                                        <ChevronDown size={18} className="text-gray-400 shrink-0" />
                                    ) : (
                                        <ChevronRight size={18} className="text-gray-400 shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-gray-900 dark:text-zinc-100 truncate">
                                            {g.company.name}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-zinc-400">
                                            {g.summary.skuCount} SKU · {fmtInt(g.summary.totalOnHand)} piezas ·{' '}
                                            {fmtInt(g.summary.totalAvailable)} libres
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-sm font-extrabold text-orange-600 dark:text-orange-400">
                                            {fmtCRC(g.summary.estimatedValue)}
                                        </div>
                                        <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-zinc-500 font-semibold">
                                            Valor estimado
                                        </div>
                                    </div>
                                </button>

                                {isOpen && <ProductTable rows={g.rows} />}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Subcomponents ───────────────────────────────────────────────────────

function ProductTable({ rows }: { rows: StockRow[] }) {
    const products = useMemo(() => groupByProduct(rows), [rows]);
    return (
        <div className="border-t border-gray-100 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-zinc-900/60 text-xs font-semibold text-gray-600 dark:text-zinc-400">
                    <tr>
                        <th className="p-3 w-14"></th>
                        <th className="p-3">Producto</th>
                        <th className="p-3">Tallas disponibles</th>
                        <th className="p-3 text-right whitespace-nowrap">En bodega</th>
                        <th className="p-3 text-right whitespace-nowrap">Libres</th>
                        <th className="p-3 text-right whitespace-nowrap">Precio</th>
                        <th className="p-3 text-right whitespace-nowrap">Valor</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {products.map((p) => (
                        <tr
                            key={p.productId}
                            className="hover:bg-gray-50 dark:hover:bg-zinc-800/60"
                        >
                            <td className="p-3 align-top">
                                {p.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={p.imageUrl}
                                        alt=""
                                        className="w-10 h-10 object-cover rounded-md border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-md border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 flex items-center justify-center text-gray-300 dark:text-zinc-600">
                                        <ImageIcon size={14} />
                                    </div>
                                )}
                            </td>
                            <td className="p-3 align-top">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900 dark:text-zinc-100">
                                        {p.productName}
                                    </span>
                                    <span
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                            p.productType === 'shirt'
                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                                                : 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300'
                                        }`}
                                    >
                                        {p.productType === 'shirt' ? 'Camisa' : 'Pantalón'}
                                    </span>
                                </div>
                                <div className="font-mono text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
                                    {p.productCode}
                                </div>
                            </td>
                            <td className="p-3 align-top">
                                <div className="flex flex-wrap gap-1.5">
                                    {p.rows.map((r) => (
                                        <SizePill key={r.id} row={r} />
                                    ))}
                                </div>
                            </td>
                            <td className="p-3 align-top text-right text-gray-900 dark:text-zinc-100 font-semibold tabular-nums">
                                {fmtInt(p.totalOnHand)}
                                {p.totalReserved > 0 && (
                                    <div className="text-[10px] text-gray-400 dark:text-zinc-500 font-normal">
                                        −{fmtInt(p.totalReserved)} reserv.
                                    </div>
                                )}
                            </td>
                            <td className="p-3 align-top text-right font-bold tabular-nums">
                                <span
                                    className={
                                        p.totalAvailable === 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-emerald-700 dark:text-emerald-300'
                                    }
                                >
                                    {fmtInt(p.totalAvailable)}
                                </span>
                            </td>
                            <td className="p-3 align-top text-right text-gray-500 dark:text-zinc-400 tabular-nums">
                                {p.unitPrice ? fmtCRC(p.unitPrice) : '—'}
                            </td>
                            <td className="p-3 align-top text-right text-gray-900 dark:text-zinc-100 font-bold tabular-nums">
                                {p.unitPrice ? fmtCRC(p.totalValue) : '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function SizePill({ row }: { row: StockRow }) {
    const label = shortSize(row.size);
    const qty = row.quantityAvailable;
    const out = qty === 0;
    const low = qty > 0 && qty <= 3;
    const reserved = row.quantityReserved > 0;

    const cls = out
        ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50'
        : low
          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60'
          : 'bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700';
    const qtyCls = out
        ? 'text-red-700 dark:text-red-300'
        : low
          ? 'text-amber-700 dark:text-amber-300'
          : 'text-gray-900 dark:text-zinc-100';

    const title = `${row.size}: ${row.quantityOnHand} en bodega${
        reserved ? ` · ${row.quantityReserved} reservadas` : ''
    } · ${qty} libres`;

    return (
        <span
            title={title}
            className={`inline-flex items-center gap-1 border rounded-md px-1.5 py-0.5 text-[11px] leading-none ${cls}`}
        >
            <span className="text-gray-500 dark:text-zinc-400 font-medium">{label}</span>
            <span className={`font-bold tabular-nums ${qtyCls}`}>{qty}</span>
            {reserved && (
                <span
                    className="w-1 h-1 rounded-full bg-orange-500"
                    aria-hidden
                    title="Tiene reservas"
                />
            )}
        </span>
    );
}

function Kpi({
    label,
    value,
    sub,
    Icon,
    accent
}: {
    label: string;
    value: string;
    sub?: string;
    Icon: React.ComponentType<{ size?: number }>;
    accent: 'orange' | 'emerald' | 'zinc' | 'blue';
}) {
    const ring =
        accent === 'orange'
            ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
            : accent === 'emerald'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
              : accent === 'blue'
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300';
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ring}`}>
                <Icon size={18} />
            </div>
            <div className="min-w-0">
                <div className="text-xs text-gray-500 dark:text-zinc-400 font-medium truncate">
                    {label}
                </div>
                <div className="text-xl font-extrabold text-gray-900 dark:text-zinc-100 leading-none mt-0.5 truncate">
                    {value}
                </div>
                {sub && (
                    <div className="text-[11px] text-gray-500 dark:text-zinc-400">{sub}</div>
                )}
            </div>
        </div>
    );
}
