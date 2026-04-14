'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { AdminProduct } from '@/lib/services/products';
import type { Product } from '@/lib/types';
import { useCart } from '@/components/cart-provider';
import { SizeSelector } from '@/components/size-selector';

type Category = 'All' | 'Men' | 'Women';

export function CatalogGrid({ catalog }: { catalog: AdminProduct[] }) {
    const [categoryFilter, setCategoryFilter] = useState<Category>('All');
    const [active, setActive] = useState<Product | null>(null);
    const { cart, addItems } = useCart();

    const filtered = catalog.filter(
        (p) => categoryFilter === 'All' || p.category === categoryFilter
    );

    return (
        <div className="pb-24 max-w-6xl mx-auto">
            <div className="px-4 pt-4 pb-6 sticky top-16 bg-zinc-50/80 backdrop-blur-md z-20">
                <div className="flex p-1.5 bg-zinc-200/50 rounded-2xl shadow-inner border border-white/50 max-w-md mx-auto">
                    {(['All', 'Men', 'Women'] as const).map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                                categoryFilter === cat
                                    ? 'bg-white text-orange-600 shadow-md ring-1 ring-black/5'
                                    : 'text-zinc-500 hover:text-zinc-700 hover:bg-white/30'
                            }`}
                        >
                            {cat === 'All' ? 'Todos' : cat === 'Men' ? 'Caballeros' : 'Damas'}
                        </button>
                    ))}
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
                            className="overflow-hidden flex flex-col group bg-white rounded-2xl border border-zinc-100 shadow-sm"
                        >
                            <div className="aspect-[4/5] overflow-hidden bg-zinc-100 relative">
                                {product.image ? (
                                    <Image
                                        src={product.image}
                                        alt={product.name}
                                        fill
                                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                        Sin imagen
                                    </div>
                                )}
                                {qtyInCart > 0 && (
                                    <div className="absolute top-4 right-4 bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg ring-2 ring-white">
                                        {qtyInCart} en carrito
                                    </div>
                                )}
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="text-lg font-bold text-zinc-900 mb-2 leading-tight">
                                    {product.name}
                                </h3>
                                <p className="text-zinc-500 text-xs mb-6 line-clamp-2 font-medium">
                                    {product.description}
                                </p>
                                <button
                                    onClick={() => setActive(product)}
                                    className="mt-auto w-full py-3.5 bg-zinc-900 text-white rounded-xl font-bold hover:bg-orange-600 transition-all shadow-lg active:scale-95"
                                >
                                    Ver Detalles
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

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
