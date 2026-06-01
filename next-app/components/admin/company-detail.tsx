'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Calendar, ClipboardList, Search } from 'lucide-react';
import type { Order } from '@/lib/types';
import { StageCompletionStrip } from '@/components/admin/stage-completion-strip';
import { STAGE_ORDER, type StageKey } from '@/lib/services/stage-completions';

interface Props {
    companyName: string;
    orders: Order[];
    initialStageCompletions: { orderId: string; stage: StageKey; completedAt: string }[];
}

type Bucket = 'all' | 'pending' | 'in-progress' | 'done' | 'cancelled';

// Read-only listing of every order belonging to a single company.
// Mirrors the bucket-and-strip shape of /admin/orders but scoped to
// this company and without the per-card action row (the global
// Pedidos page stays the surface for status editing).
export function CompanyDetail({ companyName, orders, initialStageCompletions }: Props) {
    const completedByOrder = useMemo(() => {
        const m = new Map<string, Set<StageKey>>();
        for (const c of initialStageCompletions) {
            const s = m.get(c.orderId) || new Set<StageKey>();
            s.add(c.stage);
            m.set(c.orderId, s);
        }
        return m;
    }, [initialStageCompletions]);

    const bucketFor = (o: Order): Bucket => {
        if (o.status === 'cancelled') return 'cancelled';
        const s = (o.uuid && completedByOrder.get(o.uuid)) || new Set<StageKey>();
        const done = STAGE_ORDER.filter((k) => s.has(k)).length;
        if (done === 0) return 'pending';
        if (done === STAGE_ORDER.length) return 'done';
        return 'in-progress';
    };

    const [bucket, setBucket] = useState<Bucket>('all');
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return orders.filter((o) => {
            if (bucket !== 'all' && bucketFor(o) !== bucket) return false;
            if (!q) return true;
            return (
                o.id?.toLowerCase().includes(q) ||
                (o.purchaseOrder || '').toLowerCase().includes(q)
            );
        });
    }, [orders, bucket, search]);

    const counts = useMemo(() => {
        const acc: Record<Bucket, number> = {
            all: orders.length,
            pending: 0,
            'in-progress': 0,
            done: 0,
            cancelled: 0
        };
        for (const o of orders) acc[bucketFor(o)]++;
        return acc;
    }, [orders, completedByOrder]);

    const totalPieces = (o: Order) => o.items.reduce((s, i) => s + i.quantity, 0);

    const bucketOptions: { key: Bucket; label: string; tone: string }[] = [
        { key: 'all', label: 'Todas', tone: 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900' },
        { key: 'pending', label: 'Sin iniciar', tone: 'bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300' },
        { key: 'in-progress', label: 'En proceso', tone: 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300' },
        { key: 'done', label: 'Listas', tone: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300' },
        { key: 'cancelled', label: 'Canceladas', tone: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300' }
    ];

    return (
        <section>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <ClipboardList size={18} className="text-orange-600 dark:text-orange-400" />
                    Pedidos de {companyName}
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">
                        {orders.length}
                    </span>
                </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
                {bucketOptions.map((b) => {
                    if (b.key !== 'all' && counts[b.key] === 0) return null;
                    const active = bucket === b.key;
                    return (
                        <button
                            key={b.key}
                            type="button"
                            onClick={() => setBucket(b.key)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                active
                                    ? b.tone + ' shadow-sm'
                                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                        >
                            {b.label} ({counts[b.key]})
                        </button>
                    );
                })}
            </div>

            <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm mb-4 border border-gray-200 dark:border-zinc-800">
                <div className="relative w-full max-w-md">
                    <Search
                        className="absolute left-3 top-2.5 text-gray-400 dark:text-zinc-500"
                        size={18}
                    />
                    <input
                        type="search"
                        placeholder="Buscar por ORDEN-… o orden de compra"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-transparent"
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-800">
                    {orders.length === 0
                        ? 'Esta empresa todavía no ha hecho pedidos.'
                        : 'Ningún pedido coincide con el filtro.'}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                    {filtered.map((order) => {
                        const completed =
                            (order.uuid && completedByOrder.get(order.uuid)) ||
                            new Set<StageKey>();
                        return (
                            <Link
                                key={order.uuid || order.id}
                                href="/admin/orders"
                                className="block bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-md transition-all p-4 space-y-2"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                                            {order.id}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                                            <Calendar size={11} />
                                            {new Date(order.dateCreated).toLocaleDateString()}
                                            {order.deliveryDate && (
                                                <span>
                                                    {' · Entrega '}
                                                    {new Date(order.deliveryDate).toLocaleDateString()}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <span className="bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-xs font-bold px-2 py-1 rounded-full shrink-0">
                                        {totalPieces(order)} pzas
                                    </span>
                                </div>

                                <StageCompletionStrip completed={completed} compact />

                                {order.purchaseOrder && (
                                    <p className="text-[11px] text-gray-500 dark:text-zinc-500">
                                        OC: {order.purchaseOrder}
                                    </p>
                                )}
                            </Link>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
