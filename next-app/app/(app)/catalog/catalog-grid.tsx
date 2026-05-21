'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import type { AdminProduct } from '@/lib/services/products';
import type { Product } from '@/lib/types';
import { useCart } from '@/components/cart-provider';
import { SizeSelector } from '@/components/size-selector';

type Category = 'All' | 'Men' | 'Women';

// Folded-once: strip diacritics + lowercase so "camisón" matches "camison".
// U+0300–U+036F is the Unicode combining-diacritics block; NFD-decomposing
// the string first splits e.g. "ó" into "o" + U+0301, which the regex then
// drops.
const fold = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function CatalogGrid({ catalog }: { catalog: AdminProduct[] }) {
    const [categoryFilter, setCategoryFilter] = useState<Category>('All');
    const [query, setQuery] = useState('');
    const [active, setActive] = useState<Product | null>(null);
    // Per-product image-error flag — flips a card to the placeholder if the
    // remote image 404s or otherwise fails to load, instead of leaving the
    // browser's broken-image glyph in place.
    const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});
    const { cart, addItems } = useCart();

    const foldedQuery = useMemo(() => fold(query.trim()), [query]);

    const filtered = catalog.filter((p) => {
        if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
        if (!foldedQuery) return true;
        return (
            fold(p.name).includes(foldedQuery) ||
            fold(p.description || '').includes(foldedQuery)
        );
    });

    return (
        <div className="pb-24 max-w-6xl mx-auto">
            <div className="px-4 pt-4 pb-6 sticky top-16 bg-zinc-50/85 dark:bg-zinc-950/85 backdrop-blur-md z-20">
                <div className="max-w-md mx-auto space-y-3">
                    {/* Search — folded match against name + description.
                        Sits above the chips so the catalog can be sliced two
                        ways without competing for the same axis. */}
                    <div className="relative">
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 pointer-events-none"
                        >
                            <circle cx="11" cy="11" r="7" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Buscar uniformes…"
                            className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 border border-transparent focus:border-orange-500 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none transition-colors"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                aria-label="Limpiar búsqueda"
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-3.5 h-3.5"
                                >
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {/* Flat brand chip row — matches the Type filter on /admin/stock
                        and other admin surfaces. Drops the iOS segmented-control
                        inset-shadow that read as a harsh gray bar in dark mode. */}
                    <div className="flex gap-1.5">
                        {(['All', 'Men', 'Women'] as const).map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors ${
                                    categoryFilter === cat
                                        ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                }`}
                            >
                                {cat === 'All' ? 'Todos' : cat === 'Men' ? 'Caballeros' : 'Damas'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="px-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-8">
                {filtered.map((product) => {
                    const qtyInCart = cart
                        .filter((c) => c.productId === product.id)
                        .reduce((sum, i) => sum + i.quantity, 0);
                    return (
                        <div
                            key={product.id}
                            className="overflow-hidden flex flex-col group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="aspect-[4/5] overflow-hidden bg-zinc-100 dark:bg-zinc-800 relative">
                                {product.image && !imgFailed[product.id] ? (
                                    <Image
                                        src={product.image}
                                        alt={product.name}
                                        fill
                                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                                        onError={() =>
                                            setImgFailed((prev) =>
                                                prev[product.id] ? prev : { ...prev, [product.id]: true }
                                            )
                                        }
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-600">
                                        <svg
                                            aria-hidden="true"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="w-10 h-10"
                                        >
                                            <rect x="3" y="3" width="18" height="18" rx="2" />
                                            <circle cx="9" cy="9" r="2" />
                                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                        </svg>
                                        <span className="text-xs font-medium">Sin imagen</span>
                                    </div>
                                )}
                                {qtyInCart > 0 && (
                                    <div className="absolute top-4 right-4 bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg ring-2 ring-white dark:ring-zinc-900">
                                        {qtyInCart} en carrito
                                    </div>
                                )}
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2 leading-tight">
                                    {product.name}
                                </h3>
                                <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-6 line-clamp-2 font-medium">
                                    {product.description}
                                </p>
                                <button
                                    onClick={() => setActive(product)}
                                    className="mt-auto w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-colors shadow-md shadow-orange-500/20 active:scale-95"
                                >
                                    Ver Detalles
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div className="px-4 py-16 text-center">
                    <div className="max-w-sm mx-auto">
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-12 h-12 mx-auto mb-4 text-zinc-300 dark:text-zinc-700"
                        >
                            <circle cx="11" cy="11" r="7" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                            Sin resultados
                        </h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {query
                                ? `No encontramos uniformes para "${query}".`
                                : 'No hay uniformes en esta categoría.'}
                        </p>
                        {(query || categoryFilter !== 'All') && (
                            <button
                                onClick={() => {
                                    setQuery('');
                                    setCategoryFilter('All');
                                }}
                                className="mt-4 text-sm font-bold text-orange-600 hover:text-orange-700 dark:text-orange-500 dark:hover:text-orange-400"
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                </div>
            )}

            {active && (
                <SizeSelector
                    product={active}
                    onCancel={() => setActive(null)}
                    onAdd={(items) => {
                        addItems(active.id, active.name, items);
                        setActive(null);
                    }}
                />
            )}
        </div>
    );
}
