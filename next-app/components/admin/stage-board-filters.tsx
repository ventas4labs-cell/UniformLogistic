'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Filter, X } from 'lucide-react';
import type { Order } from '@/lib/types';
import type { StageTab } from '@/components/admin/stage-tab-bar';

interface Props {
    orders: Order[];
    counts: { pending: number; done: number; all: number };
    tab: StageTab;
    setTab: (t: StageTab) => void;
    companyFilter: string;
    setCompanyFilter: (c: string) => void;
}

// Single icon button — slot it into a board's title-row action cluster
// (next to search / refresh). The popover floats absolutely below the
// button so it doesn't push the page around.
export function StageBoardFilters({
    orders,
    counts,
    tab,
    setTab,
    companyFilter,
    setCompanyFilter
}: Props) {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Click-outside / Escape closes the popover.
    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (!wrapperRef.current) return;
            if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

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
        <div ref={wrapperRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={`relative p-2 rounded-lg ${
                    open || filtersActive
                        ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                        : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700'
                }`}
                title="Filtros"
                aria-label="Filtros"
            >
                <Filter size={18} />
                {filtersActive && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange-600 ring-2 ring-white dark:ring-zinc-950" />
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 z-30 w-80 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-800 p-4 space-y-4">
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
                                className="flex-1 p-2 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-orange-500 outline-none"
                            >
                                <option value="all">
                                    Todas ({distinctCompanies.length})
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
        </div>
    );
}

// Optional active-filter pill row to render below the title bar when
// the popover is closed. Keeps admin aware of which filters are on
// without expanding the popover. Boards can opt in if they have room.
export function StageBoardActiveFilterPills({
    tab,
    setTab,
    companyFilter,
    setCompanyFilter
}: Pick<Props, 'tab' | 'setTab' | 'companyFilter' | 'setCompanyFilter'>) {
    if (tab === 'pending' && companyFilter === 'all') return null;
    return (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
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
    );
}
