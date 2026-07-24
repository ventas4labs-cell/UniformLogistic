'use client';

import { useState } from 'react';
import { ImageIcon, X } from 'lucide-react';

// ─── Shared product thumbnail + full-size viewer ─────────────────────
// Production boards show a compact thumbnail per line so the operator
// can see the garment; tapping it opens a full-screen view, which is
// what they actually match against the piece on the table.
//
// Usage:
//   const { openZoom, zoomModal } = useProductZoom();
//   <ProductThumb item={item} onZoom={openZoom} />
//   {zoomModal}   // render once per card/list

export interface ZoomTarget {
    url: string;
    name: string;
}

export interface ThumbItem {
    imageUrl?: string;
    productName: string;
}

export function useProductZoom() {
    const [zoom, setZoom] = useState<ZoomTarget | null>(null);

    const zoomModal = zoom ? (
        <div
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4"
            onClick={() => setZoom(null)}
            role="dialog"
            aria-modal="true"
            aria-label={`Imagen de ${zoom.name}`}
        >
            <button
                type="button"
                onClick={() => setZoom(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Cerrar"
            >
                <X size={22} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={zoom.url}
                alt={zoom.name}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[80vh] max-w-full rounded-2xl shadow-2xl object-contain"
            />
            <p className="mt-4 text-white font-semibold text-center">{zoom.name}</p>
        </div>
    ) : null;

    return { openZoom: setZoom, zoomModal };
}

export function ProductThumb({
    item,
    onZoom
}: {
    item: ThumbItem;
    onZoom: (z: ZoomTarget) => void;
}) {
    if (!item.imageUrl) {
        return (
            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-zinc-700 shrink-0 flex items-center justify-center">
                <ImageIcon size={16} className="text-gray-400 dark:text-zinc-500" />
            </div>
        );
    }
    const url = item.imageUrl;
    return (
        <button
            type="button"
            onClick={() => onZoom({ url, name: item.productName })}
            className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-zinc-700 active:scale-95 transition-transform hover:ring-2 hover:ring-orange-400"
            title="Ver imagen del producto"
            aria-label={`Ver imagen de ${item.productName}`}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={url}
                alt={item.productName}
                loading="lazy"
                className="w-full h-full object-cover"
            />
        </button>
    );
}
