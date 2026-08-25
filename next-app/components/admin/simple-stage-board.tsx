'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    RefreshCw,
    Sparkles,
    PackageCheck,
    PenTool,
    ChevronDown,
    ChevronUp,
    HardHat,
    X,
    type LucideIcon
} from 'lucide-react';
import { ProductThumb, useProductZoom } from '@/components/admin/product-thumb';
import type { Order } from '@/lib/types';
import { StageCompleteToggle } from '@/components/admin/stage-complete-toggle';
import type { StageTab } from '@/components/admin/stage-tab-bar';
import { StageBoardFilters } from '@/components/admin/stage-board-filters';
import type { StageKey } from '@/lib/services/stage-completions';
import type { ItemProgress } from '@/lib/services/stage-item-progress';
import type { Logo, LogoCategory } from '@/lib/services/logos';
import { CollapsibleSearch } from '@/components/admin/collapsible-search';
import { FilterSelect } from '@/components/admin/filter-controls';
import { CompletedSection } from '@/components/admin/completed-section';
import { OrderLogosButton } from '@/components/admin/order-logos-modal';
import { OrderProductsSummary } from '@/components/admin/order-products-summary';
import { StagePartialEditor } from '@/components/admin/stage-partial-editor';
import {
    OrderReportButton,
    MissingReportsHistoryButton
} from '@/components/admin/missing-report-controls';

// Generic stage board for stages whose UI is just "list of orders with
// a per-order completion toggle" — no insumo handling, no global
// summary view. Drives Impresión-shaped stages (Bordado, Empaque,
// Ploter). The icon component reference can't cross a server→client
// boundary, so the server page only passes the stage key and we look
// up the visual config inside this client component.
interface Props {
    initialOrders: Order[];
    initialCompletedOrderIds: string[];
    stage: StageKey;
    /** Logos catalog — only passed for stages that show a per-order
     * Logos button (Bordado). Joined live for size/notes in the modal. */
    logos?: Logo[];
    /** When true, each card exposes a per-line "done / total" editor for
     * recording partial progress (Bordado). */
    allowPartial?: boolean;
    /** Board-wide map of order_item_id → qty done, for the partial editor. */
    initialProgress?: ItemProgress;
    /**
     * orderId → external station name(s) working this stage. When any
     * are present the board grows a "Todos / Asignados a estación" scope
     * tab plus a station picker; boards that never outsource (Ploter)
     * simply omit it and see no change.
     */
    assignedStationsByOrder?: Record<string, string[]>;
}

// Stages whose boards surface a Logos button, mapped to the logo
// category they display. Only Bordado for the simple boards; Impresión
// has its own board. Empaque / Ploter show no logos.
const STAGE_LOGO_CATEGORY: Partial<Record<StageKey, LogoCategory>> = {
    bordado: 'bordado'
};

type AccentKey = 'rose' | 'sky' | 'emerald';

interface StageConfig {
    title: string;
    Icon: LucideIcon;
    accent: AccentKey;
}

const STAGE_CONFIG: Partial<Record<StageKey, StageConfig>> = {
    bordado: { title: 'Bordado', Icon: Sparkles, accent: 'rose' },
    empaque: { title: 'Empaque', Icon: PackageCheck, accent: 'emerald' },
    ploter: { title: 'Ploter', Icon: PenTool, accent: 'sky' }
};

const ACCENT_TEXT: Record<AccentKey, string> = {
    rose: 'text-rose-600 dark:text-rose-400',
    sky: 'text-sky-600 dark:text-sky-400',
    emerald: 'text-emerald-600 dark:text-emerald-400'
};

// Cards are uniform: the item list shows at most this many rows, with
// a min-height so short orders match. Longer orders collapse to this
// count behind an expand chevron so one big order can't tower over the
// rest of the grid.
const MAX_VISIBLE_ITEMS = 4;
function OrderCard({
    order,
    stage,
    isCompleted,
    onLocalChange,
    logoCategory,
    logos,
    allowPartial,
    initialProgress,
    stationNames = []
}: {
    order: Order;
    stage: StageKey;
    isCompleted: boolean;
    onLocalChange: (uuid: string, next: boolean) => void;
    logoCategory?: LogoCategory;
    logos?: Logo[];
    allowPartial?: boolean;
    initialProgress?: ItemProgress;
    /** External station(s) this order is assigned to, if any. */
    stationNames?: string[];
}) {
    const totalPieces = order.items.reduce((s, i) => s + i.quantity, 0);
    const [expanded, setExpanded] = useState(false);
    // Tapping a line's thumbnail opens the product full-size.
    const { openZoom, zoomModal } = useProductZoom();
    const visibleItems = expanded
        ? order.items
        : order.items.slice(0, MAX_VISIBLE_ITEMS);
    const hiddenCount = Math.max(0, order.items.length - MAX_VISIBLE_ITEMS);

    return (
        <div
            className={`bg-white dark:bg-zinc-900 rounded-xl shadow-sm border overflow-hidden flex flex-col ${
                isCompleted
                    ? 'border-green-200 dark:border-green-900/40'
                    : 'border-gray-200 dark:border-zinc-800'
            } ${
                // Produced by an external workshop — dimmed so nobody on
                // this board starts working it by mistake. Brightens on
                // hover/focus so the details stay readable when needed.
                stationNames.length > 0
                    ? 'opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity'
                    : ''
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
                        locked={stationNames.length > 0}
                        orderUuid={order.uuid}
                        orderRef={order.id}
                        stage={stage}
                        isCompleted={isCompleted}
                        onLocalChange={onLocalChange}
                    />
                </div>

                <OrderProductsSummary items={order.items} />

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-xs font-bold px-2 py-1 rounded-full">
                        {totalPieces} pzas
                    </span>
                    <span className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 text-xs font-bold px-2 py-1 rounded-full">
                        {order.items.length} líneas
                    </span>
                    {stationNames.length > 0 && (
                        <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 text-xs font-bold px-2 py-1 rounded-full">
                            <HardHat size={12} /> {stationNames.join(', ')}
                        </span>
                    )}
                    {logoCategory && (
                        <OrderLogosButton
                            order={order}
                            category={logoCategory}
                            logos={logos || []}
                        />
                    )}
                </div>

                {order.notes && (
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 italic line-clamp-2">
                        {order.notes}
                    </p>
                )}
            </div>

            <div className="border-t border-gray-100 dark:border-zinc-800 flex-1 flex flex-col">
                {allowPartial ? (
                    <div className="p-4 flex-1">
                        <StagePartialEditor
                        locked={stationNames.length > 0}
                            order={order}
                            stage={stage}
                            initialProgress={initialProgress || {}}
                            isCompleted={isCompleted}
                            onCompletedChange={onLocalChange}
                        />
                    </div>
                ) : (
                <div className="p-4 flex flex-col flex-1 min-h-[160px]">
                    <div className="space-y-1.5">
                        {visibleItems.map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-3 text-sm bg-gray-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2"
                            >
                                <ProductThumb item={item} onZoom={openZoom} />
                                <div className="min-w-0 flex-1">
                                    <span className="font-medium text-gray-900 dark:text-zinc-100">
                                        {item.productName}
                                    </span>
                                    <span className="text-gray-500 dark:text-zinc-400 ml-2 text-xs">
                                        {item.selection.size || ''}
                                    </span>
                                </div>
                                <span className="font-bold text-gray-700 dark:text-zinc-200 shrink-0 ml-2">
                                    x{item.quantity}
                                </span>
                            </div>
                        ))}
                    </div>
                    {hiddenCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setExpanded((e) => !e)}
                            className="mt-auto pt-3 flex items-center justify-center gap-1 text-xs font-bold text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
                            aria-expanded={expanded}
                        >
                            {expanded ? (
                                <>
                                    <ChevronUp size={14} /> Ver menos
                                </>
                            ) : (
                                <>
                                    <ChevronDown size={14} /> +{hiddenCount} líneas más
                                </>
                            )}
                        </button>
                    )}
                </div>
                )}
            </div>
            {order.uuid && (
                <div className="border-t border-gray-100 dark:border-zinc-800 px-4 py-3">
                    <OrderReportButton orderId={order.uuid} stage={stage} />
                </div>
            )}
            {zoomModal}
        </div>
    );
}

export function SimpleStageBoard({
    initialOrders,
    initialCompletedOrderIds,
    stage,
    logos,
    allowPartial,
    initialProgress,
    assignedStationsByOrder = {}
}: Props) {
    const config = STAGE_CONFIG[stage];
    if (!config) {
        throw new Error(`SimpleStageBoard: no visual config for stage "${stage}"`);
    }
    const { title, Icon, accent } = config;
    const logoCategory = STAGE_LOGO_CATEGORY[stage];
    const [orders] = useState<Order[]>(initialOrders);
    const [completed, setCompleted] = useState<Set<string>>(
        () => new Set(initialCompletedOrderIds)
    );
    const [tab, setTab] = useState<StageTab>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [companyFilter, setCompanyFilter] = useState<string>('all');
    // Assignment scope + station picker. Only rendered when this stage
    // actually outsources work, so boards without stations are untouched.
    const [assignTab, setAssignTab] = useState<'all' | 'assigned'>('all');
    const [stationFilter, setStationFilter] = useState<string>('all');
    const router = useRouter();

    const stationsFor = (o: Order): string[] =>
        (o.uuid && assignedStationsByOrder[o.uuid]) || [];
    const assignedCount = orders.filter((o) => stationsFor(o).length > 0).length;
    const stationOptions = useMemo(
        () =>
            Array.from(
                new Set(
                    Object.values(assignedStationsByOrder).flat() as string[]
                )
            ).sort((a, b) => a.localeCompare(b, 'es')),
        [assignedStationsByOrder]
    );
    // Picking one station is a visibility view like "Asignados": show all
    // of that station's work, not just what's still pending.
    const singleStation = stationFilter !== 'all' && stationFilter !== 'none';

    const handleLocalChange = (uuid: string, next: boolean) => {
        setCompleted((prev) => {
            const n = new Set(prev);
            if (next) n.add(uuid);
            else n.delete(uuid);
            return n;
        });
    };

    const scoped = useMemo(
        () => {
            let list = orders;
            if (stationFilter === 'none') {
                list = list.filter((o) => stationsFor(o).length === 0);
            } else if (singleStation) {
                list = list.filter((o) => stationsFor(o).includes(stationFilter));
            } else if (assignTab === 'assigned') {
                list = list.filter((o) => stationsFor(o).length > 0);
            }
            return list;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [orders, assignTab, stationFilter, singleStation, assignedStationsByOrder]
    );

    const tabFiltered = useMemo(() => {
        if (assignTab === 'assigned' || singleStation) return scoped;
        if (tab === 'all') return scoped;
        if (tab === 'done') return scoped.filter((o) => o.uuid && completed.has(o.uuid));
        return scoped.filter((o) => !(o.uuid && completed.has(o.uuid)));
    }, [scoped, completed, tab, assignTab, singleStation]);

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

    // Never mix finished work with what's still pending: when the current
    // result set holds both, the completed ones move into a collapsed
    // "Completados" section underneath.
    const pendingList = filtered.filter((o) => !(o.uuid && completed.has(o.uuid)));
    const doneList = filtered.filter((o) => o.uuid && completed.has(o.uuid));
    const splitCompleted = pendingList.length > 0 && doneList.length > 0;

    const counts = {
        pending: scoped.filter((o) => !(o.uuid && completed.has(o.uuid))).length,
        done: scoped.filter((o) => o.uuid && completed.has(o.uuid)).length,
        all: scoped.length
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <Icon size={24} className={ACCENT_TEXT[accent]} />
                        {title}
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Cada pedido aparece acá apenas se crea. Marcalo como
                        completado cuando {title.toLowerCase()} esté listo.
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
                    <MissingReportsHistoryButton stage={stage} />
                    <button
                        onClick={() => router.refresh()}
                        className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                        title="Recargar"
                        aria-label="Recargar"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Assignment scope + station picker. Only rendered when this
                stage outsources work. The two stay in sync so the UI never
                highlights two contradictory filters. */}
            {stationOptions.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <div className="inline-flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                        {(
                            [
                                { key: 'all', label: 'Todos', count: orders.length },
                                {
                                    key: 'assigned',
                                    label: 'Asignados a estación',
                                    count: assignedCount
                                }
                            ] as const
                        ).map((t) => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => {
                                    setAssignTab(t.key);
                                    setStationFilter('all');
                                }}
                                className={`inline-flex items-center gap-1.5 px-4 min-h-11 rounded-lg text-sm font-bold transition-colors ${
                                    assignTab === t.key
                                        ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100'
                                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                                }`}
                            >
                                {t.key === 'assigned' && <HardHat size={14} />}
                                {t.label}
                                <span
                                    className={`min-w-[1.3rem] px-1 rounded-full text-[11px] leading-5 ${
                                        assignTab === t.key
                                            ? 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300'
                                            : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                                    }`}
                                >
                                    {t.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <FilterSelect
                            label="Estación"
                            value={stationFilter}
                            onChange={(v) => {
                                setStationFilter(v);
                                if (v !== 'all') setAssignTab('all');
                            }}
                            options={[
                                { value: 'none', label: 'Sin asignar (interno)' },
                                ...stationOptions.map((n) => ({ value: n, label: n }))
                            ]}
                        />
                        {stationFilter !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setStationFilter('all')}
                                className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 px-2 py-1.5 rounded-lg transition-colors"
                            >
                                <X size={13} /> Quitar
                            </button>
                        )}
                    </div>
                </div>
            )}

            {filtered.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400">
                    {singleStation
                        ? `${stationFilter} no tiene pedidos de ${title.toLowerCase()} asignados.`
                        : stationFilter === 'none'
                        ? `Todos los pedidos de ${title.toLowerCase()} están asignados a una estación externa.`
                        : assignTab === 'assigned'
                        ? `Ningún pedido de ${title.toLowerCase()} está asignado a una estación externa.`
                        : tab === 'pending'
                        ? `No hay pedidos pendientes de ${title.toLowerCase()}.`
                        : tab === 'done'
                            ? `Todavía no se ha completado ningún pedido en ${title.toLowerCase()}.`
                            : 'No hay pedidos.'}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                        {(splitCompleted ? pendingList : filtered).map((order) => (
                        <OrderCard
                            key={order.uuid || order.id}
                            order={order}
                            stage={stage}
                            isCompleted={!!order.uuid && completed.has(order.uuid)}
                            onLocalChange={handleLocalChange}
                            logoCategory={logoCategory}
                            logos={logos}
                            allowPartial={allowPartial}
                            initialProgress={initialProgress}
                            stationNames={stationsFor(order)}
                        />
                        ))}
                    </div>
                    {splitCompleted && (
                        <CompletedSection count={doneList.length}>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                                {doneList.map((order) => (
                        <OrderCard
                            key={order.uuid || order.id}
                            order={order}
                            stage={stage}
                            isCompleted={!!order.uuid && completed.has(order.uuid)}
                            onLocalChange={handleLocalChange}
                            logoCategory={logoCategory}
                            logos={logos}
                            allowPartial={allowPartial}
                            initialProgress={initialProgress}
                            stationNames={stationsFor(order)}
                        />
                                ))}
                            </div>
                        </CompletedSection>
                    )}
                </>
            )}
        </div>
    );
}
