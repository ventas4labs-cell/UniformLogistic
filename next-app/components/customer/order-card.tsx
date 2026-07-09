import {
    Calendar,
    CheckCircle2,
    Clock,
    Factory,
    Truck,
    XCircle
} from 'lucide-react';
import type { Order } from '@/lib/types';
import type { CustomerOrderProgress, CustomerBucket } from '@/lib/customer-order-status';
import { OrderDetailsButton } from '@/components/customer/order-details-modal';

// Status is derived from real production progress (order_stage_completions
// + order_dispatches), NOT the legacy orders.status column — see
// lib/customer-order-status.ts. The parallel stages render as an
// independent completion strip (each segment fills when its stage is
// done), so the bar reflects true progress rather than a fake pipeline.

export function OrderCard({
    order,
    progress
}: {
    order: Order;
    progress: CustomerOrderProgress;
}) {
    const { bucket, statusLabel, stages, doneCount, totalStages, totalPieces, deliveredPieces } =
        progress;
    const partiallyDelivered =
        bucket !== 'completed' && deliveredPieces > 0 && deliveredPieces < totalPieces;

    const accent =
        bucket === 'ready'
            ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20'
            : bucket === 'completed'
              ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
              : bucket === 'cancelled'
                ? 'border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/15'
                : 'border-orange-200 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-950/15';

    const showStrip = bucket === 'production' || bucket === 'ready';

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
                <StatusBadge bucket={bucket} label={statusLabel} />
            </div>

            {/* Parallel stage completion strip */}
            {showStrip && totalStages > 0 && (
                <div className="mt-4">
                    <div className="flex items-center gap-1">
                        {stages.map((s) => (
                            <div
                                key={s.key}
                                title={`${s.label}${s.done ? ' · completado' : ' · pendiente'}`}
                                className={`flex-1 h-1.5 rounded-full ${
                                    s.done ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'
                                }`}
                            />
                        ))}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        <span>
                            {doneCount}/{totalStages} etapas
                        </span>
                        <span className="truncate ml-2">
                            {stages
                                .filter((s) => !s.done)
                                .map((s) => s.label)
                                .slice(0, 3)
                                .join(' · ') || 'Todas listas'}
                        </span>
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
                    {partiallyDelivered && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <Truck size={13} />
                            {deliveredPieces}/{totalPieces} entregadas
                        </span>
                    )}
                </div>
                <OrderDetailsButton order={order} progress={progress} />
            </div>
        </div>
    );
}

function StatusBadge({ bucket, label }: { bucket: CustomerBucket; label: string }) {
    const map: Record<
        CustomerBucket,
        { cls: string; Icon: React.ComponentType<{ size?: number }> }
    > = {
        production: {
            cls: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
            Icon: Factory
        },
        ready: {
            cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
            Icon: Truck
        },
        completed: {
            cls: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300',
            Icon: CheckCircle2
        },
        cancelled: {
            cls: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
            Icon: XCircle
        }
    };
    const { cls, Icon } = map[bucket];
    return (
        <span
            className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}
        >
            <Icon size={12} />
            {label}
        </span>
    );
}
