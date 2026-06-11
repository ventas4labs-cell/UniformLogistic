'use client';

import { useMemo, useState } from 'react';
import { Sticker, X, Sparkles, Printer } from 'lucide-react';
import type { Order } from '@/lib/types';
import type { Logo, LogoCategory } from '@/lib/services/logos';

// Logos button + modal for the production boards. Walks an order's
// items, pulls the logo rows out of each product's BOM (filtered to the
// board's category), and shows them grouped by product. The logo's
// catalog `size`/`notes` are joined live from `logos` (so edits in the
// Logos catalog show immediately); the per-product `logoPlacement` is
// read straight off the BOM row.

interface ResolvedLogo {
    key: string;
    name: string;
    imageUrl: string;
    size: string;
    notes: string;
    placement: string;
}

interface ProductLogos {
    productId: string;
    productName: string;
    logos: ResolvedLogo[];
}

function buildProductLogos(
    order: Order,
    category: LogoCategory,
    lookup: Map<string, Logo>
): ProductLogos[] {
    const groups = new Map<string, ProductLogos>();
    for (const item of order.items) {
        const logoRows = (item.bom || []).filter(
            (b) => b.logoId && b.logoCategory === category
        );
        if (logoRows.length === 0) continue;
        // Same product across multiple sizes shares one BOM, so group
        // by product and dedupe identical (logo + placement) entries.
        const groupKey = item.productId || item.productName;
        let group = groups.get(groupKey);
        if (!group) {
            group = {
                productId: groupKey,
                productName: item.productName,
                logos: []
            };
            groups.set(groupKey, group);
        }
        for (const row of logoRows) {
            const dedupeKey = `${row.logoId}|${row.logoPlacement || ''}`;
            if (group.logos.some((l) => l.key === dedupeKey)) continue;
            const cat = lookup.get(row.logoId as string);
            group.logos.push({
                key: dedupeKey,
                name: cat?.name || row.name,
                imageUrl: cat?.imageUrl || row.logoImageUrl || '',
                size: cat?.size || '',
                notes: cat?.notes || '',
                placement: row.logoPlacement || ''
            });
        }
    }
    return Array.from(groups.values());
}

export function OrderLogosButton({
    order,
    category,
    logos
}: {
    order: Order;
    category: LogoCategory;
    logos: Logo[];
}) {
    const [open, setOpen] = useState(false);
    // Image URL of the logo currently hovered — drives the enlarged
    // preview. Rendered as a viewport-centered fixed overlay so the
    // modal's scroll/overflow-hidden can't clip it.
    const [zoom, setZoom] = useState<string | null>(null);
    const lookup = useMemo(
        () => new Map(logos.map((l) => [l.id, l])),
        [logos]
    );
    const groups = useMemo(
        () => buildProductLogos(order, category, lookup),
        [order, category, lookup]
    );
    const total = groups.reduce((s, g) => s + g.logos.length, 0);

    const CatIcon = category === 'bordado' ? Sparkles : Printer;
    const catLabel = category === 'bordado' ? 'Bordado' : 'Impresión';
    const catAccent =
        category === 'bordado'
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-pink-600 dark:text-pink-400';

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                title="Ver logos del pedido"
            >
                <Sticker size={13} />
                Logos
                {total > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-[10px] leading-none">
                        {total}
                    </span>
                )}
            </button>

            {open && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-xl max-h-[85vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-100 dark:border-zinc-800">
                            <div className="min-w-0">
                                <h3 className="font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                                    <CatIcon size={18} className={catAccent} />
                                    Logos de {catLabel}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                                    <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                                        {order.id}
                                    </span>
                                    {order.companyName && (
                                        <span className="ml-2">{order.companyName}</span>
                                    )}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg shrink-0"
                                aria-label="Cerrar"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-4 space-y-5">
                            {groups.length === 0 ? (
                                <p className="text-center text-sm text-gray-500 dark:text-zinc-400 py-8">
                                    Este pedido no tiene logos de{' '}
                                    {catLabel.toLowerCase()} asignados a sus
                                    productos.
                                </p>
                            ) : (
                                groups.map((g) => (
                                    <div key={g.productId}>
                                        <p className="font-semibold text-sm text-gray-900 dark:text-zinc-100 mb-2">
                                            {g.productName}
                                        </p>
                                        <div className="space-y-2">
                                            {g.logos.map((l) => (
                                                <div
                                                    key={l.key}
                                                    className="flex gap-3 p-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40"
                                                >
                                                    {l.imageUrl ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={l.imageUrl}
                                                            alt={l.name}
                                                            onMouseEnter={() =>
                                                                setZoom(l.imageUrl)
                                                            }
                                                            onMouseLeave={() =>
                                                                setZoom(null)
                                                            }
                                                            className="w-16 h-16 object-contain bg-white border border-gray-100 dark:border-zinc-700 rounded-lg shrink-0 cursor-zoom-in transition-transform hover:scale-105"
                                                        />
                                                    ) : (
                                                        <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                                            <Sticker
                                                                size={20}
                                                                className="text-gray-400"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1 text-sm">
                                                        <p className="font-bold text-gray-900 dark:text-zinc-100">
                                                            {l.name}
                                                        </p>
                                                        {l.size && (
                                                            <p className="text-xs text-gray-600 dark:text-zinc-300 mt-0.5">
                                                                <span className="font-semibold">
                                                                    Tamaño:
                                                                </span>{' '}
                                                                {l.size}
                                                            </p>
                                                        )}
                                                        {l.placement && (
                                                            <p className="text-xs text-gray-700 dark:text-zinc-200 mt-0.5">
                                                                <span className="font-semibold">
                                                                    En este producto:
                                                                </span>{' '}
                                                                {l.placement}
                                                            </p>
                                                        )}
                                                        {l.notes && (
                                                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 italic">
                                                                {l.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {zoom && (
                        <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center p-8">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={zoom}
                                alt=""
                                className="max-w-[80vw] max-h-[80vh] object-contain bg-white rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700 p-2"
                            />
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
