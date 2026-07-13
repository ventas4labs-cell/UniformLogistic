'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { X, Package, Calendar, Building2, User, Boxes, Loader2, ImageIcon } from 'lucide-react';
import type { Order } from '@/lib/types';

// R3F is heavy + client-only — mount the viewer lazily and only when the
// admin expands it, so the WebGL context is created (and released) on
// demand rather than for every detail view.
const ModelViewer3D = dynamic(() => import('@/components/custom-order/model-viewer-3d'), {
    ssr: false,
    loading: () => (
        <div className="h-72 flex items-center justify-center text-sm text-gray-400">
            <Loader2 className="animate-spin mr-2" size={16} /> Cargando visor 3D…
        </div>
    )
});

export interface OrderModel3D {
    productCode: string;
    modelUrl: string;
    name: string;
}

// Detailed, read-only view of an order: header, per-line items with
// sizes / quantities / logos, and — when a product in the order has a
// linked 3D model — an expandable 3D preview of that model.
export function OrderDetailModal({
    order,
    model,
    onClose
}: {
    order: Order;
    model: OrderModel3D | null;
    onClose: () => void;
}) {
    const [show3D, setShow3D] = useState(false);
    const totalPieces = order.items.reduce((s, i) => s + i.quantity, 0);

    return (
        <div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
                    <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                            {order.id}
                        </p>
                        <p className="text-lg font-bold text-gray-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
                            <Building2 size={16} className="text-gray-400 shrink-0" />
                            {order.companyName || '—'}
                        </p>
                        {order.customerName && (
                            <p className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                                <User size={12} /> {order.customerName}
                            </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                            <Calendar size={12} />
                            {new Date(order.dateCreated).toLocaleDateString()}
                            {order.deliveryDate && (
                                <span>· Entrega: {new Date(order.deliveryDate).toLocaleDateString()}</span>
                            )}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 shrink-0"
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 space-y-5">
                    {/* Chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-xs font-bold px-2 py-1 rounded-full">
                            {totalPieces} pzas
                        </span>
                        <span className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 text-xs font-bold px-2 py-1 rounded-full">
                            {order.items.length} líneas
                        </span>
                        {order.purchaseOrder && (
                            <span className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 text-xs font-bold px-2 py-1 rounded-full">
                                OC: {order.purchaseOrder}
                            </span>
                        )}
                    </div>

                    {/* 3D model, when a product in this order has one */}
                    {model && (
                        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setShow3D((s) => !s)}
                                className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-bold text-sm"
                            >
                                <span className="flex items-center gap-2">
                                    <Boxes size={16} /> Modelo 3D: {model.name}
                                </span>
                                <span className="text-xs font-semibold">
                                    {show3D ? 'Ocultar' : 'Ver en 3D'}
                                </span>
                            </button>
                            {show3D && (
                                <div className="h-80 bg-zinc-50 dark:bg-zinc-950">
                                    <ModelViewer3D url={model.modelUrl} color="#c9ccd1" logos={[]} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Items */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">
                            Artículos
                        </h4>
                        <div className="space-y-2">
                            {order.items.map((item, idx) => {
                                const logos = (item.bom || []).filter(
                                    (b) => b.logoId || b.logoImageUrl
                                );
                                return (
                                    <div
                                        key={item.uuid || idx}
                                        className="rounded-lg border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40 p-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            {item.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.productName}
                                                    className="w-11 h-11 rounded-lg object-cover border border-gray-200 dark:border-zinc-700 shrink-0 bg-white dark:bg-zinc-900"
                                                />
                                            ) : (
                                                <div className="w-11 h-11 rounded-lg bg-gray-200 dark:bg-zinc-700 shrink-0 flex items-center justify-center">
                                                    <ImageIcon size={16} className="text-gray-400 dark:text-zinc-500" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-gray-900 dark:text-zinc-100 truncate">
                                                    {item.productName}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-zinc-400">
                                                    {item.selection.size || '—'}
                                                    {item.fabricType ? ` · ${item.fabricType}` : ''}
                                                </p>
                                            </div>
                                            <span className="font-mono font-bold text-gray-700 dark:text-zinc-200 shrink-0">
                                                ×{item.quantity}
                                            </span>
                                        </div>
                                        {logos.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5 pl-14">
                                                {logos.map((l, i) => (
                                                    <span
                                                        key={i}
                                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-full px-2 py-0.5"
                                                    >
                                                        {l.logoImageUrl && (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={l.logoImageUrl}
                                                                alt={l.name}
                                                                className="w-4 h-4 rounded object-contain"
                                                            />
                                                        )}
                                                        {l.name}
                                                        {l.logoPlacement ? ` · ${l.logoPlacement}` : ''}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {order.notes && (
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
                                <Package size={12} /> Notas
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-zinc-300 italic">
                                {order.notes}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
