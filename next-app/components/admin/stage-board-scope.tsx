'use client';

import { useMemo, useState } from 'react';
import { HardHat, X } from 'lucide-react';
import type { Order } from '@/lib/types';
import type { StageTab } from '@/components/admin/stage-tab-bar';
import { PillGroup } from '@/components/admin/filter-controls';
import {
    inStationScope,
    scopeStationName,
    stationScope,
    type StationScope
} from '@/lib/station-scope';

// ─── Shared filters for the production-stage boards ─────────────────────
// Corte, Empaque and Maquila filter the same way: Estado (pendientes /
// completados / todos), Estación (todas / interno / externas / one
// station), Empresa and the search box. Every filter always applies — none
// is skipped because of another selection — and each pill's count is what
// that choice would show given the OTHER filters, so the active pill always
// equals the cards on screen. The boards each used to carry their own copy
// of this logic, and the copies drifted into ignoring Estado whenever a
// station was picked.

export function useStageBoardFilters({
    orders,
    completed,
    assignedStationsByOrder
}: {
    orders: Order[];
    /** uuids of the orders this stage has finished. */
    completed: Set<string>;
    /** orderId → external station name(s) working this stage. */
    assignedStationsByOrder: Record<string, string[]>;
}) {
    const [tab, setTab] = useState<StageTab>('pending');
    const [scope, setScope] = useState<StationScope>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [companyFilter, setCompanyFilter] = useState<string>('all');

    const stationsFor = (o: Order): string[] =>
        (o.uuid && assignedStationsByOrder[o.uuid]) || [];
    const isDone = (o: Order) => !!o.uuid && completed.has(o.uuid);

    // Stations with work on THIS board — not every assignment the page
    // loaded — so no pill ever offers a choice that would return nothing.
    const stationNames = useMemo(
        () =>
            Array.from(
                new Set(
                    orders.flatMap((o) => (o.uuid && assignedStationsByOrder[o.uuid]) || [])
                )
            ).sort((a, b) => a.localeCompare(b, 'es')),
        [orders, assignedStationsByOrder]
    );
    // A station can drop off the board after a refresh (its last order
    // moved on); fall back to "Todas" instead of a pill nobody can see.
    const picked = scopeStationName(scope);
    const activeScope: StationScope =
        picked && !stationNames.includes(picked) ? 'all' : scope;

    const term = searchTerm.trim().toLowerCase();
    const matchesStatus = (o: Order, t: StageTab) =>
        t === 'all' || (t === 'done') === isDone(o);
    const base = orders.filter(
        (o) =>
            (companyFilter === 'all' || o.companyName === companyFilter) &&
            (!term ||
                o.customerName?.toLowerCase().includes(term) ||
                o.companyName?.toLowerCase().includes(term) ||
                o.id?.toLowerCase().includes(term))
    );
    const inScope = base.filter((o) => inStationScope(stationsFor(o), activeScope));
    const filtered = inScope.filter((o) => matchesStatus(o, tab));

    const statusCounts = {
        pending: inScope.filter((o) => !isDone(o)).length,
        done: inScope.filter(isDone).length,
        all: inScope.length
    };
    const withStatus = base.filter((o) => matchesStatus(o, tab));
    const scopeCount = (s: StationScope) =>
        withStatus.filter((o) => inStationScope(stationsFor(o), s)).length;
    const scopeOptions: {
        value: StationScope;
        label: string;
        count: number;
        icon?: React.ReactNode;
    }[] = [
        { value: 'all', label: 'Todas', count: scopeCount('all') },
        { value: 'internal', label: 'Interno', count: scopeCount('internal') },
        {
            value: 'external',
            label: 'Externas',
            count: scopeCount('external'),
            icon: <HardHat size={14} />
        },
        ...stationNames.map((name) => ({
            value: stationScope(name),
            label: name,
            count: scopeCount(stationScope(name)),
            icon: <HardHat size={14} />
        }))
    ];

    // Never mix finished work with what's still pending: when the result
    // set holds both ("Todos"), the completed ones go in a collapsed
    // "Completados" section underneath.
    const pendingList = filtered.filter((o) => !isDone(o));
    const doneList = filtered.filter(isDone);

    return {
        tab,
        setTab,
        scope: activeScope,
        setScope,
        searchTerm,
        setSearchTerm,
        companyFilter,
        setCompanyFilter,
        stationsFor,
        isDone,
        stationNames,
        statusCounts,
        scopeOptions,
        filtered,
        pendingList,
        doneList,
        splitCompleted: pendingList.length > 0 && doneList.length > 0,
        filtersChanged:
            tab !== 'pending' || activeScope !== 'all' || companyFilter !== 'all' || !!term,
        resetFilters: () => {
            setTab('pending');
            setScope('all');
            setCompanyFilter('all');
            setSearchTerm('');
        }
    };
}

export type StageBoardFilterState = ReturnType<typeof useStageBoardFilters>;

/** The Estado and Estación pill rows that sit above a stage board's cards.
 *  Estación only appears once some of the board's work is outsourced. */
export function StageBoardFilterBar({ filters }: { filters: StageBoardFilterState }) {
    const { tab, setTab, statusCounts, stationNames, scope, setScope, scopeOptions } =
        filters;
    return (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4">
            <PillGroup
                label="Estado"
                value={tab}
                onChange={setTab}
                options={[
                    { value: 'pending', label: 'Pendientes', count: statusCounts.pending },
                    { value: 'done', label: 'Completados', count: statusCounts.done },
                    { value: 'all', label: 'Todos', count: statusCounts.all }
                ]}
            />
            {stationNames.length > 0 && (
                <PillGroup
                    label="Estación"
                    value={scope}
                    onChange={setScope}
                    options={scopeOptions}
                />
            )}
        </div>
    );
}

/** Empty state that spells out the selection it is empty for — "No hay
 *  pedidos completados de corte en Corte Taller de SISTEN SA." — with a
 *  reset whenever a filter is narrowing the board. */
export function StageBoardEmptyState({
    filters,
    stage
}: {
    filters: StageBoardFilterState;
    /** Lower-case stage noun for the message: "corte", "empaque"… */
    stage: string;
}) {
    const { tab, scope, companyFilter, searchTerm, filtersChanged, resetFilters } = filters;
    const station = scopeStationName(scope);
    let msg =
        tab === 'pending'
            ? 'No hay pedidos pendientes'
            : tab === 'done'
              ? 'No hay pedidos completados'
              : 'No hay pedidos';
    msg += ` de ${stage}`;
    if (scope === 'internal') msg += ' del taller interno';
    else if (scope === 'external') msg += ' en estaciones externas';
    else if (station) msg += ` en ${station}`;
    if (companyFilter !== 'all') msg += ` de ${companyFilter}`;
    if (searchTerm.trim()) msg += ` que coincidan con “${searchTerm.trim()}”`;

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-zinc-500 dark:text-zinc-400">
            <p>{msg}.</p>
            {filtersChanged && (
                <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 min-h-11 rounded-lg text-sm font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
                >
                    <X size={15} /> Quitar filtros
                </button>
            )}
        </div>
    );
}
