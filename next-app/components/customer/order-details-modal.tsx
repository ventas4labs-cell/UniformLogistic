'use client';

import { useEffect, useState } from 'react';
import {
    ArrowRight,
    X,
    CheckCircle2,
    Circle,
    Calendar,
    Clock,
    Truck,
    Package,
    ImageIcon
} from 'lucide-react';
import type { Order, SizeSelection } from '@/lib/types';
import type { CustomerOrderProgress, CustomerBucket } from '@/lib/customer-order-status';

const BUCKET_BADGE: Record<CustomerBucket, string> = {
    production: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
    ready: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
    completed: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
};

function sizeLabel(sel: SizeSelection): string {
    if (sel.waist) {
        return sel.inseam ? `C${sel.waist}" / L${sel.inseam}"` : `C${sel.waist}"`;
    }
    const g = sel.gender ? (sel.gender === 'Men' ? 'H · ' : 'M · ') : '';
    return `${g}${sel.size || ''}`.trim() || '—';
}

export function OrderDetailsButton({
    order,
    progress
}: {
    order: Order;
    progress: CustomerOrderProgress;
}) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-semibold"
            >
                Detalles <ArrowRight size={13} />
            </button>
            {open && (
                <OrderDetailsModal
                    order={order}
                    progress={progress}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}

function OrderDetailsModal({
    order,
    progress,
    onClose
}: {
    order: Order;
    progress: CustomerOrderProgress;
    onClose: () => void;
}) {
    // Close on Escape.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const { bucket, statusLabel, stages, totalPieces, deliveredPieces } = progress;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 p-5 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                        <p className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                            {order.id}
                        </p>
                        <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                            {totalPieces} pieza{totalPieces === 1 ? '' : 's'} ·{' '}
                            {order.items.length} artículo{order.items.length === 1 ? '' : 's'}
                        </p>
                        {order.companyName && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {order.companyName}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span
                            className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${BUCKET_BADGE[bucket]}`}
                        >
                            {statusLabel}
                        </span>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                            aria-label="Cerrar"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto p-5 space-y-5 flex-1">
                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1.5">
                            <Clock size={13} />
                            Creado {new Date(order.dateCreated).toLocaleDateString()}
                        </span>
                        {order.deliveryDate && (
                            <span className="inline-flex items-center gap-1.5">
                                <Calendar size={13} />
                                Entrega {order.deliveryDate}
                            </span>
                        )}
                        {order.purchaseOrder && (
                            <span className="inline-flex items-center gap-1.5">
                                <Package size={13} />
                                OC {order.purchaseOrder}
                            </span>
                        )}
                        {deliveredPieces > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                                <Truck size={13} />
                                {deliveredPieces}/{totalPieces} entregadas
                            </span>
                        )}
                    </div>

                    {/* Production progress */}
                    {bucket !== 'cancelled' && stages.length > 0 && (
                        <section>
                            <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                                Progreso de producción
                            </h4>
                            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {stages.map((s) => (
                                    <li
                                        key={s.key}
                                        className={`flex items-center gap-1.5 text-sm rounded-lg px-2.5 py-1.5 ${
                                            s.done
                                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                                                : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400'
                                        }`}
                                    >
                                        {s.done ? (
                                            <CheckCircle2 size={14} className="shrink-0" />
                                        ) : (
                                            <Circle size={14} className="shrink-0" />
                                        )}
                                        {s.label}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Items */}
                    <section>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                            Artículos
                        </h4>
                        <div className="space-y-1.5">
                            {order.items.map((it, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2"
                                >
                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-zinc-700">
                                        {it.imageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={it.imageUrl}
                                                alt={it.productName}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ImageIcon
                                                    size={16}
                                                    className="text-zinc-300 dark:text-zinc-600"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                            {it.productName}
                                        </p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {sizeLabel(it.selection)}
                                            {it.fabricType ? ` · ${it.fabricType}` : ''}
                                        </p>
                                    </div>
                                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200 shrink-0">
                                        ×{it.quantity}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Notes */}
                    {order.notes && (
                        <section>
                            <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                                Notas
                            </h4>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 italic bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
                                {order.notes}
                            </p>
                        </section>
                    )}
                </div>

                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg font-bold text-zinc-700 dark:text-zinc-300"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
