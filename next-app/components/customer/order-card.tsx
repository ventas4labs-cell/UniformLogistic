import Link from 'next/link';
import { ArrowRight, Calendar, CheckCircle2, Clock, Package } from 'lucide-react';
import type { Order } from '@/lib/types';

const PRODUCTION_STAGES = [
    { key: 'bodega', label: 'Bodega' },
    { key: 'corte', label: 'Corte' },
    { key: 'maquila', label: 'Maquila' },
    { key: 'impresion', label: 'Impresión' },
    { key: 'empaque', label: 'Empaque' }
] as const;

type StageKey = (typeof PRODUCTION_STAGES)[number]['key'];

const stageIndex = (status: string): number => {
    if (status === 'pending') return -1;
    const idx = PRODUCTION_STAGES.findIndex((s) => s.key === status);
    return idx;
};

export function OrderCard({ order, variant }: { order: Order; variant: 'production' | 'ready' | 'completed' }) {
    const totalPieces = order.items.reduce((s, i) => s + i.quantity, 0);
    const status = (order.status || 'pending') as StageKey | 'pending' | 'completed' | 'cancelled';
    const isCompleted = status === 'completed';
    const activeIdx = isCompleted ? PRODUCTION_STAGES.length - 1 : stageIndex(status);

    const accent =
        variant === 'ready'
            ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20'
            : variant === 'completed'
              ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
              : 'border-orange-200 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-950/15';

    return (
        <div className={`rounded-2xl border ${accent} p-4 sm:p-5 hover:shadow-md transition-shadow`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{order.id}</div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                        {totalPieces} pieza{totalPieces === 1 ? '' : 's'} · {order.items.length} artículo
                        {order.items.length === 1 ? '' : 's'}
                    </div>
                </div>
                <StatusBadge status={status} />
            </div>

            {/* Stage progress (hidden when completed-already-delivered or cancelled) */}
            {variant !== 'completed' && status !== 'cancelled' && (
                <div className="mt-4">
                    <div className="flex items-center gap-1">
                        {PRODUCTION_STAGES.map((stage, idx) => {
                            const reached = idx <= activeIdx;
                            const current = idx === activeIdx;
                            return (
                                <div
                                    key={stage.key}
                                    className={`flex-1 h-1.5 rounded-full ${
                                        current
                                            ? 'bg-orange-500'
                                            : reached
                                              ? 'bg-orange-300 dark:bg-orange-700'
                                              : 'bg-zinc-200 dark:bg-zinc-700'
                                    }`}
                                />
                            );
                        })}
                    </div>
                    <div className="mt-1.5 flex justify-between text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {PRODUCTION_STAGES.map((stage, idx) => (
                            <span
                                key={stage.key}
                                className={
                                    idx === activeIdx
                                        ? 'text-orange-600 dark:text-orange-400 font-bold'
                                        : idx < activeIdx
                                          ? 'text-zinc-700 dark:text-zinc-300'
                                          : ''
                                }
                            >
                                {stage.label}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                        <Clock size={13} />
                        {new Date(order.dateCreated).toLocaleDateString()}
                    </span>
                    {order.deliveryDate && (
                        <span className="inline-flex items-center gap-1">
                            <Calendar size={13} />
                            Entrega {order.deliveryDate}
                        </span>
                    )}
                </div>
                <Link
                    href="/orders"
                    className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-semibold"
                >
                    Detalles <ArrowRight size={13} />
                </Link>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string; Icon: React.ComponentType<{ size?: number }> }> = {
        pending: { label: 'Pendiente', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300', Icon: Clock },
        bodega: { label: 'Bodega', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300', Icon: Package },
        corte: { label: 'Corte', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300', Icon: Package },
        maquila: { label: 'Maquila', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300', Icon: Package },
        impresion: { label: 'Impresión', cls: 'bg-pink-100 text-pink-800 dark:bg-pink-950/50 dark:text-pink-300', Icon: Package },
        empaque: { label: 'Empaque · Listo', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300', Icon: CheckCircle2 },
        completed: { label: 'Completado', cls: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300', Icon: CheckCircle2 },
        cancelled: { label: 'Cancelado', cls: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300', Icon: Clock }
    };
    const entry = map[status] || map.pending;
    const Icon = entry.Icon;
    return (
        <span
            className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${entry.cls}`}
        >
            <Icon size={12} />
            {entry.label}
        </span>
    );
}
