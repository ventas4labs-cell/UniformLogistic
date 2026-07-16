'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Truck,
    RefreshCw,
    CalendarClock,
    CheckCircle2,
    Send,
    Undo2,
    X,
    Loader2,
    Building2,
    Package,
    Copy,
    Check,
    Smartphone,
    RefreshCcw
} from 'lucide-react';
import {
    scheduleDeliveryAction,
    notifyDeliveryTodayAction,
    clearScheduleAction,
    markDeliveredAction,
    regenerateDriverLinkAction
} from '@/app/(admin)/admin/entregas/actions';

export interface DeliverySummary {
    uuid: string;
    ref: string;
    companyName: string;
    contactName: string;
    requestedDeliveryDate: string;
    totalPieces: number;
    items: string[];
    scheduledDate: string | null;
    notifiedAt: string | null;
    deliveredAt: string | null;
}

type Tab = 'pending' | 'plan' | 'delivered';

const todayIso = () => new Date().toISOString().slice(0, 10);

// Format a YYYY-MM-DD date without timezone drift.
function fmtDate(iso: string): string {
    const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
}
function dateHeading(iso: string): string {
    const t = todayIso();
    if (iso === t) return `Hoy · ${fmtDate(iso)}`;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (iso === tomorrow.toISOString().slice(0, 10)) return `Mañana · ${fmtDate(iso)}`;
    return fmtDate(iso);
}

export function DeliveryBoard({
    initialSummaries,
    initialDriverToken
}: {
    initialSummaries: DeliverySummary[];
    initialDriverToken: string | null;
}) {
    const [summaries, setSummaries] = useState<DeliverySummary[]>(initialSummaries);
    const [tab, setTab] = useState<Tab>('pending');
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    // Driver link — origin filled after mount to avoid a hydration
    // mismatch on the copied URL.
    const [driverToken, setDriverToken] = useState<string | null>(initialDriverToken);
    const [origin, setOrigin] = useState('');
    useEffect(() => setOrigin(window.location.origin), []);
    const [copied, setCopied] = useState(false);
    const [genBusy, setGenBusy] = useState(false);
    const driverUrl = driverToken
        ? `${origin || ''}/d/${driverToken}`
        : '';

    const copyDriverLink = async () => {
        if (!driverUrl) return;
        try {
            await navigator.clipboard.writeText(driverUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            prompt('Copiá el link:', driverUrl);
        }
    };
    const regenDriverLink = async () => {
        if (driverToken && !confirm('¿Generar un link nuevo? El anterior dejará de funcionar.')) {
            return;
        }
        setGenBusy(true);
        const res = await regenerateDriverLinkAction();
        setGenBusy(false);
        if (res.error) {
            alert(res.error);
            return;
        }
        if (res.token) setDriverToken(res.token);
    };

    const patch = (uuid: string, changes: Partial<DeliverySummary>) =>
        setSummaries((prev) =>
            prev.map((s) => (s.uuid === uuid ? { ...s, ...changes } : s))
        );

    const run = (
        uuid: string,
        optimistic: Partial<DeliverySummary>,
        action: () => Promise<{ error?: string }>
    ) => {
        const prev = summaries.find((s) => s.uuid === uuid);
        patch(uuid, optimistic);
        setBusy(uuid);
        startTransition(async () => {
            const res = await action();
            setBusy(null);
            if (res.error) {
                if (prev) patch(uuid, prev);
                alert(res.error);
                router.refresh();
            }
        });
    };

    const bucketOf = (s: DeliverySummary): Tab =>
        s.deliveredAt ? 'delivered' : s.scheduledDate ? 'plan' : 'pending';

    const matchesSearch = (s: DeliverySummary) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
            s.ref.toLowerCase().includes(q) ||
            (s.companyName || '').toLowerCase().includes(q) ||
            s.items.some((i) => i.toLowerCase().includes(q))
        );
    };

    const counts = {
        pending: summaries.filter((s) => bucketOf(s) === 'pending').length,
        plan: summaries.filter((s) => bucketOf(s) === 'plan').length,
        delivered: summaries.filter((s) => bucketOf(s) === 'delivered').length
    };

    const visible = summaries.filter((s) => bucketOf(s) === tab && matchesSearch(s));

    // Group the plan by scheduled date for the review view.
    const planGroups = useMemo(() => {
        if (tab !== 'plan') return [];
        const map = new Map<string, DeliverySummary[]>();
        for (const s of visible) {
            const key = s.scheduledDate || '—';
            (map.get(key) || map.set(key, []).get(key)!).push(s);
        }
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [tab, visible]);

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <Truck size={24} className="text-orange-600 dark:text-orange-400" />
                        Entregas
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Pedidos despachados listos para entregar. Programá fechas, avisá
                        al cliente y marcá cada entrega.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar orden, empresa o artículo…"
                            className="pl-3 pr-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-orange-500 outline-none w-56"
                        />
                    </div>
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

            {/* Driver link — mobile review of the day's plan */}
            <div className="mb-5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
                <div className="flex items-center gap-2 mb-1">
                    <Smartphone size={16} className="text-orange-600 dark:text-orange-400" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                        Link del chofer
                    </h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">
                    Compartí este link con el mensajero. Lo abre en el celular para
                    revisar las entregas programadas del día.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    {driverToken ? (
                        <>
                            <code className="flex-1 min-w-0 truncate text-xs font-mono bg-gray-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-gray-700 dark:text-zinc-300">
                                {driverUrl || `/d/${driverToken}`}
                            </code>
                            <button
                                type="button"
                                onClick={copyDriverLink}
                                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                                    copied
                                        ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300'
                                        : 'bg-orange-600 text-white hover:bg-orange-700'
                                }`}
                            >
                                {copied ? <Check size={15} /> : <Copy size={15} />}
                                {copied ? 'Copiado' : 'Copiar'}
                            </button>
                            <button
                                type="button"
                                onClick={regenDriverLink}
                                disabled={genBusy}
                                title="Generar link nuevo"
                                className="p-2 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg disabled:opacity-50"
                            >
                                {genBusy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={regenDriverLink}
                            disabled={genBusy}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
                        >
                            {genBusy ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />}
                            Generar link del chofer
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="inline-flex items-center gap-1 p-1 mb-5 bg-gray-100 dark:bg-zinc-800 rounded-xl">
                {(
                    [
                        { key: 'pending', label: 'Por entregar', count: counts.pending },
                        { key: 'plan', label: 'Plan de entregas', count: counts.plan },
                        { key: 'delivered', label: 'Entregados', count: counts.delivered }
                    ] as const
                ).map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                            tab === t.key
                                ? 'bg-white dark:bg-zinc-900 shadow-sm text-gray-900 dark:text-zinc-100'
                                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
                        }`}
                    >
                        {t.label}
                        <span
                            className={`min-w-[1.3rem] px-1 rounded-full text-[11px] leading-5 ${
                                tab === t.key
                                    ? 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300'
                                    : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300'
                            }`}
                        >
                            {t.count}
                        </span>
                    </button>
                ))}
            </div>

            {visible.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400">
                    {tab === 'pending'
                        ? 'No hay pedidos despachados por entregar.'
                        : tab === 'plan'
                            ? 'No hay entregas programadas.'
                            : 'Todavía no se ha entregado ningún pedido.'}
                </div>
            ) : tab === 'plan' ? (
                <div className="space-y-6">
                    {planGroups.map(([date, group]) => (
                        <div key={date}>
                            <div className="flex items-center gap-2 mb-2">
                                <CalendarClock size={16} className="text-orange-600 dark:text-orange-400" />
                                <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                                    {dateHeading(date)}
                                </h3>
                                <span className="text-xs text-gray-500 dark:text-zinc-400">
                                    {group.length} pedido{group.length === 1 ? '' : 's'}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {group.map((s) => (
                                    <DeliveryCard
                                        key={s.uuid}
                                        s={s}
                                        busy={busy === s.uuid}
                                        run={run}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                    {visible.map((s) => (
                        <DeliveryCard key={s.uuid} s={s} busy={busy === s.uuid} run={run} />
                    ))}
                </div>
            )}
        </div>
    );
}

function DeliveryCard({
    s,
    busy,
    run
}: {
    s: DeliverySummary;
    busy: boolean;
    run: (
        uuid: string,
        optimistic: Partial<DeliverySummary>,
        action: () => Promise<{ error?: string }>
    ) => void;
}) {
    const delivered = !!s.deliveredAt;

    return (
        <div
            className={`bg-white dark:bg-zinc-900 rounded-xl border shadow-sm overflow-hidden ${
                delivered
                    ? 'border-green-200 dark:border-green-900/40'
                    : 'border-gray-200 dark:border-zinc-800'
            }`}
        >
            <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                            {s.ref}
                        </p>
                        <p className="font-semibold text-gray-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
                            <Building2 size={14} className="text-gray-400 shrink-0" />
                            {s.companyName || '—'}
                        </p>
                        {s.contactName && (
                            <p className="text-xs text-gray-500 dark:text-zinc-400">{s.contactName}</p>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        {s.notifiedAt && !delivered && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/40 px-1.5 py-0.5 rounded-full">
                                <Send size={10} /> Cliente avisado
                            </span>
                        )}
                        {delivered && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-950/40 px-1.5 py-0.5 rounded-full">
                                <CheckCircle2 size={10} /> Entregado
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-xs font-bold px-2 py-1 rounded-full">
                        {s.totalPieces} pzas
                    </span>
                    {s.requestedDeliveryDate && (
                        <span className="text-xs text-gray-500 dark:text-zinc-400">
                            Solicitada: {new Date(s.requestedDeliveryDate).toLocaleDateString()}
                        </span>
                    )}
                </div>

                {s.items.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 line-clamp-2 flex items-start gap-1">
                        <Package size={12} className="mt-0.5 shrink-0" />
                        <span>{s.items.join(', ')}</span>
                    </p>
                )}
            </div>

            {!delivered ? (
                <div className="border-t border-gray-100 dark:border-zinc-800 p-3 space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                        Fecha de entrega
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={s.scheduledDate || ''}
                            disabled={busy}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (!v) {
                                    run(s.uuid, { scheduledDate: null, notifiedAt: null }, () =>
                                        clearScheduleAction(s.uuid)
                                    );
                                } else {
                                    run(s.uuid, { scheduledDate: v }, () =>
                                        scheduleDeliveryAction(s.uuid, v)
                                    );
                                }
                            }}
                            className="flex-1 p-2 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                        {s.scheduledDate && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    run(s.uuid, { scheduledDate: null, notifiedAt: null }, () =>
                                        clearScheduleAction(s.uuid)
                                    )
                                }
                                title="Quitar del plan"
                                className="p-2 text-gray-400 hover:text-red-600 rounded-lg"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                                run(
                                    s.uuid,
                                    { scheduledDate: todayIso(), notifiedAt: new Date().toISOString() },
                                    () => notifyDeliveryTodayAction(s.uuid)
                                )
                            }
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                            title="Programar para hoy y avisar al cliente"
                        >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            Entregar hoy
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                                run(s.uuid, { deliveredAt: new Date().toISOString() }, () =>
                                    markDeliveredAction(s.uuid, true)
                                )
                            }
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                            <CheckCircle2 size={14} /> Entregado
                        </button>
                    </div>
                </div>
            ) : (
                <div className="border-t border-gray-100 dark:border-zinc-800 p-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-zinc-400">
                        Entregado {new Date(s.deliveredAt!).toLocaleDateString()}
                    </span>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                            run(s.uuid, { deliveredAt: null }, () =>
                                markDeliveredAction(s.uuid, false)
                            )
                        }
                        className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-zinc-400 hover:text-amber-600"
                    >
                        <Undo2 size={12} /> Deshacer
                    </button>
                </div>
            )}
        </div>
    );
}
