'use client';

import { useState } from 'react';
import { Home, HardHat } from 'lucide-react';
import type { Order } from '@/lib/types';
import type { InsumoCompletion } from '@/lib/services/insumo-completions';
import { MaquilaBoard } from '@/components/admin/maquila-board';
import {
    ExternalStationPanel,
    type StationWorkItem
} from '@/components/admin/external-station-panel';

export interface MaquilaStationInfo {
    id: string;
    name: string;
}

interface Props {
    inHouse: {
        initialOrders: Order[];
        initialCompletedOrderIds: string[];
        initialInsumoCompletions: InsumoCompletion[];
    };
    stations: MaquilaStationInfo[];
    workByStation: Record<string, StationWorkItem[]>;
}

const readyCountOf = (items: StationWorkItem[] | undefined): number =>
    (items || []).filter((w) => w.readyForPickupAt && !w.pickedUpAt).length;

// The Maquila module reframed around who's producing: "En taller" is the
// in-house board (unchanged); every other tab is one external maquila
// station's outsourced orders, where the office records pickups.
export function MaquilaModule({ inHouse, stations, workByStation }: Props) {
    const [selected, setSelected] = useState<string>('interno');

    return (
        <div>
            <header className="mb-5">
                <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Maquila
                </h1>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Producción en taller y seguimiento por maquila externa.
                </p>
            </header>

            {/* Station selector */}
            <div
                className="-mx-4 mb-6 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
                role="tablist"
                aria-label="Seleccionar taller o estación"
            >
                <SelectorTab
                    active={selected === 'interno'}
                    onClick={() => setSelected('interno')}
                    icon={<Home size={16} />}
                    label="En taller"
                    count={inHouse.initialOrders.length}
                />
                {stations.map((s) => (
                    <SelectorTab
                        key={s.id}
                        active={selected === s.id}
                        onClick={() => setSelected(s.id)}
                        icon={<HardHat size={16} />}
                        label={s.name}
                        count={(workByStation[s.id] || []).length}
                        badge={readyCountOf(workByStation[s.id])}
                    />
                ))}
            </div>

            {selected === 'interno' ? (
                <MaquilaBoard
                    initialOrders={inHouse.initialOrders}
                    initialCompletedOrderIds={inHouse.initialCompletedOrderIds}
                    initialInsumoCompletions={inHouse.initialInsumoCompletions}
                />
            ) : (
                <ExternalStationPanel
                    stationId={selected}
                    stationName={
                        stations.find((s) => s.id === selected)?.name || 'Estación'
                    }
                    items={workByStation[selected] || []}
                    completedOrderIds={inHouse.initialCompletedOrderIds}
                />
            )}
        </div>
    );
}

function SelectorTab({
    active,
    onClick,
    icon,
    label,
    count,
    badge = 0
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    count: number;
    badge?: number;
}) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={`relative inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 min-h-11 text-sm font-bold transition-colors ${
                active
                    ? 'border-orange-600 bg-orange-600 text-white shadow-sm'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-orange-300 hover:text-orange-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-orange-500/40 dark:hover:text-orange-300'
            }`}
        >
            <span className={active ? 'text-white' : 'text-zinc-400 dark:text-zinc-500'}>
                {icon}
            </span>
            {label}
            <span
                className={`rounded-full px-1.5 text-xs font-bold ${
                    active
                        ? 'bg-white/20 text-white'
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
            >
                {count}
            </span>
            {badge > 0 && (
                <span
                    className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[11px] font-extrabold text-white ring-2 ring-white dark:ring-zinc-950"
                    title={`${badge} listo(s) para recoger`}
                >
                    {badge}
                </span>
            )}
        </button>
    );
}
