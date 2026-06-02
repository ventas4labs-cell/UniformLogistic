'use client';

import { useMemo, useState } from 'react';
import { Filter, X } from 'lucide-react';
import type { Order } from '@/lib/types';
import type { StageTab } from '@/components/admin/stage-tab-bar';

interface Props {
    // Used to derive the empresa dropdown — every distinct company
    // present in the board's order list shows up, sorted A→Z.
    orders: Order[];
    counts: { pending: number; done: number; all: number };
    tab: StageTab;
    setTab: (t: StageTab) => void;
    companyFilter: string;
    setCompanyFilter: (c: string) => void;
}

// Shared filter UI for every stage board (Bodega, Corte, Maquila,
// Impresión, Bordado, Empaque, Ploter). Same icon-and-popover shape
// as /admin/orders so admin only learns one filter pattern.
//
// Closed → just a Filter icon button (with an orange dot when any
// filter is non-default) and a compact "Filtros activos:" pill row
// below summarizing what's on. Open → panel with Estado tabs +
// Empresa dropdown.
export function StageBoardFilters({
    orders,
    counts,
    tab,
    setTab,
    companyFilter,
    setCompanyFilter
}: Props) {
    const [open, setOpen] = useState(false);

    const distinctCompanies = useMemo(
        () =>
            Array.from(
                new Set(
                    orders.map((o) => o.companyName).filter(Boolean) as string[]
                )
            ).sort((a, b) => a.localeCompare(b)),
        [orders]
    );

    const filtersActive = tab !== 'pending' || companyFilter !== 'all';

    return (
        <div className="mb-4">
            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className={`relative inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                        open || filtersActive
                            ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                    }`}
                    title="Filtros"
                    aria-label="Filtros"
                >
                    <Filter size={14} />
                    Filtros
                    {filtersActive && (
                        <span className="ml-1 w-2 h-2 rounded-full bg-orange-600" />
                    )}
                </button>

                {/* Pending-count summary on the right so admin still
                    sees how many orders the default view captures
                    without expanding the panel. */}
                <span className="text-xs text-gray-500 dark:text-zinc-500">
                    {tab === 'pending'
                        ? `${counts.pending} pendiente${counts.pending === 1 ? '' : 's'}`
                        : tab === 'done'
                            ? `${counts.done} completado${counts.done === 1 ? '' : 's'}`
                            : `${counts.all} pedido${counts.all === 1 ? '' : 's'}`}
                </span>
            </div>

            {open && (
                <div className="mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-4 space-y-4">
                    <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-500 mb-2">
                            Estado
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {(
                                [
                                    { key: 'pending', label: 'Pendientes', count: counts.pending, color: 'bg-orange-600 text-white' },
                                    { key: 'done', label: 'Completados', count: counts.done, color: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300' },
                                    { key: 'all', label: 'Todos', count: counts.all, color: 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900' }
                                ] as const
                            ).map((t) => {
                                const active = tab === t.key;
                                return (
                                    <button
                                        key={t.key}
                                        type="button"
                                        onClick={() => setTab(t.key)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                            active
                                                ? t.color + ' shadow-md'
                                                : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                        }`}
                                    >
                                        {t.label} ({t.count})
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-500 mb-2">
                            Empresa
                        </h4>
                        <div className="flex items-center gap-2">
                            <select
                                value={companyFilter}
                                onChange={(e) => setCompanyFilter(e.target.value)}
                                className="flex-1 max-w-md p-2 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-orange-500 outline-none"
                            >
                                <option value="all">
                                    Todas las empresas ({distinctCompanies.length})
                                </option>
                                {distinctCompanies.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                            {companyFilter !== 'all' && (
                                <button
                                    type="button"
                                    onClick={() => setCompanyFilter('all')}
                                    className="text-xs font-bold text-gray-500 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400"
                                >
                                    Limpiar
                                </button>
                            )}
                        </div>
                    </div>

                    {filtersActive && (
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-zinc-800">
                            <button
                                type="button"
                                onClick={() => {
                                    setTab('pending');
                                    setCompanyFilter('all');
                                }}
                                className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
                            >
                                Restablecer
                            </button>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="text-xs font-bold text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
                            >
                                Listo
                            </button>
                        </div>
                    )}
                </div>
            )}

            {!open && filtersActive && (
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                    <span className="text-gray-500 dark:text-zinc-500 font-semibold">
                        Filtros activos:
                    </span>
                    {tab !== 'pending' && (
                        <button
                            type="button"
                            onClick={() => setTab('pending')}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-bold hover:bg-orange-200 dark:hover:bg-orange-950/60"
                            title="Volver a Pendientes"
                        >
                            {tab === 'done' ? 'Completados' : 'Todos'}
                            <X size={11} />
                        </button>
                    )}
                    {companyFilter !== 'all' && (
                        <button
                            type="button"
                            onClick={() => setCompanyFilter('all')}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-bold hover:bg-orange-200 dark:hover:bg-orange-950/60"
                            title="Quitar filtro de empresa"
                        >
                            {companyFilter}
                            <X size={11} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
