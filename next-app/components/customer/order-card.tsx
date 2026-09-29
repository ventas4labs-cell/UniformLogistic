import Link from 'next/link';
import { Calendar, CheckCircle2, Clock, ImageIcon, PackageMinus, Truck, XCircle } from 'lucide-react';
import type { Order, CartItem } from '@/lib/types';
import type { CustomerOrderProgress, CustomerBucket } from '@/lib/customer-order-status';
import { OrderDetailsButton } from '@/components/customer/order-details-modal';

// One line of truth per order: Pendiente or Listo. The stage strip, the
// "x/y despachadas" and "x/y en tu bodega" counters that used to live
// here were internal workshop state — see lib/customer-order-status.ts.
//
// What DID belong here is the picture: an order reads as "12 piezas · 1
// artículo" to us and as "which one was that?" to the customer, so each
// card leads with the product photos it actually contains.

const THUMB_LIMIT = 3;

interface ProductThumb {
    name: string;
    imageUrl?: string;
}

/** Distinct products in the order, first photo found per product. */
function productThumbs(items: CartItem[]): ProductThumb[] {
    const byName = new Map<string, string | undefined>();
    for (const it of items) {
        const current = byName.get(it.productName);
        // First occurrence wins, except when a later line is the one
        // carrying the photo (extras join no products row).
        if (!byName.has(it.productName) || (!current && it.imageUrl)) {
            byName.set(it.productName, it.imageUrl);
        }
    }
    return Array.from(byName, ([name, imageUrl]) => ({ name, imageUrl }));
}

export function OrderCard({
    order,
    progress,
    withdrawablePieces = 0
}: {
    order: Order;
    progress: CustomerOrderProgress;
    /**
     * Pieces this order put in the customer's bodega that can still be
     * withdrawn. When > 0 on a ready order, the card offers "Retirar",
     * which opens the retiro picker with the order preloaded.
     */
    withdrawablePieces?: number;
}) {
    const { bucket, statusLabel, totalPieces } = progress;

    const thumbs = productThumbs(order.items);
    const shown = thumbs.slice(0, THUMB_LIMIT);
    const overflow = thumbs.length - shown.length;

    // Two names fit; three joined names just truncate into one unreadable
    // string, so past that we name the first and count the rest.
    const summary =
        thumbs.length <= 2
            ? thumbs.map((p) => p.name).join(' · ')
            : `${thumbs[0].name} +${thumbs.length - 1} más`;

    const accent =
        bucket === 'ready'
            ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20'
            : bucket === 'completed'
              ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
              : bucket === 'cancelled'
                ? 'border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/15'
                : 'border-orange-200 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-950/15';

    return (
        <div className={`rounded-2xl border ${accent} p-4 sm:p-5 hover:shadow-md transition-shadow`}>
            <div className="flex items-start justify-between gap-3">
                <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{order.id}</div>
                <StatusBadge bucket={bucket} label={statusLabel} />
            </div>

            {/* What's in the box — photos first, so the customer can tell
                one order from another at a glance. */}
            <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-1.5 shrink-0">
                    {shown.map((p) => (
                        <Thumb key={p.name} name={p.name} imageUrl={p.imageUrl} />
                    ))}
                    {overflow > 0 && (
                        <div className="w-12 h-12 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500 dark:text-zinc-400 shrink-0">
                            +{overflow}
                        </div>
                    )}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {summary}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {totalPieces} pieza{totalPieces === 1 ? '' : 's'} · {order.items.length} artículo
                        {order.items.length === 1 ? '' : 's'}
                    </p>
                </div>
            </div>

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
                <div className="ml-auto flex items-center gap-3">
                    {bucket === 'ready' && withdrawablePieces > 0 && order.uuid && (
                        <Link
                            href={`/stock?retirar=${order.uuid}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold px-3 py-1.5 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                            title={`Solicitar un retiro de las ${withdrawablePieces} piezas en tu bodega`}
                        >
                            <PackageMinus size={13} />
                            Retirar
                        </Link>
                    )}
                    <OrderDetailsButton order={order} progress={progress} />
                </div>
            </div>
        </div>
    );
}

function Thumb({ name, imageUrl }: ProductThumb) {
    return (
        <div className="w-12 h-12 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shrink-0">
            {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center" title={name}>
                    <ImageIcon size={16} className="text-zinc-300 dark:text-zinc-600" />
                </div>
            )}
        </div>
    );
}

function StatusBadge({ bucket, label }: { bucket: CustomerBucket; label: string }) {
    const map: Record<
        CustomerBucket,
        { cls: string; Icon: React.ComponentType<{ size?: number }> }
    > = {
        pending: {
            cls: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
            Icon: Clock
        },
        ready: {
            cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
            Icon: CheckCircle2
        },
        completed: {
            cls: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
            Icon: Truck
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
