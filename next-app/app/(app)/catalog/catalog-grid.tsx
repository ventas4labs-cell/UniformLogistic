'use client';

import Image from 'next/image';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Repeat, Sparkles } from 'lucide-react';
import type { AdminProduct } from '@/lib/services/products';
import type { ThreeDModel } from '@/lib/services/three-d-models';
import type { Logo } from '@/lib/services/logos';
import type { Product } from '@/lib/types';
import { useCart } from '@/components/cart-provider';
import { SizeSelector } from '@/components/size-selector';
import { BasicItemFlow } from './basic-item-flow';
import { clearActingCompanyAction } from './actions';

type Category = 'All' | 'Men' | 'Women';
type BasicItem = { product: AdminProduct; model: ThreeDModel };

const fold = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Props {
    catalog: AdminProduct[];
    basics: BasicItem[];
    companyLogos: Logo[];
    actingCompany?: { id: string; name: string } | null;
}

export function CatalogGrid({ catalog, basics, companyLogos, actingCompany }: Props) {
    const router = useRouter();
    const [categoryFilter, setCategoryFilter] = useState<Category>('All');
    const [query, setQuery] = useState('');
    const [active, setActive] = useState<Product | null>(null);
    const [activeBasic, setActiveBasic] = useState<BasicItem | null>(null);
    const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});
    const { cart, addItems, clear, openCart } = useCart();
    const [isSwitching, startSwitch] = useTransition();

    const handleSwitchCompany = () => {
        clear();
        startSwitch(async () => {
            await clearActingCompanyAction();
            router.refresh();
        });
    };

    const foldedQuery = useMemo(() => fold(query.trim()), [query]);

    const match = (p: AdminProduct) => {
        if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
        if (!foldedQuery) return true;
        return fold(p.name).includes(foldedQuery) || fold(p.description || '').includes(foldedQuery);
    };
    const ownFiltered = catalog.filter(match);
    const basicsFiltered = basics.filter((b) => match(b.product));
    const nothing = ownFiltered.length === 0 && basicsFiltered.length === 0;

    return (
        <div className="pb-24 max-w-6xl mx-auto">
            {actingCompany && (
                <div className="px-4 pt-4">
                    <div className="max-w-3xl mx-auto flex items-center gap-3 p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50">
                        <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center text-orange-600 dark:text-orange-300 shrink-0">
                            <Building2 size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700 dark:text-orange-400">
                                Pedido a nombre de
                            </p>
                            <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                {actingCompany.name}
                            </p>
                        </div>
                        <button
                            onClick={handleSwitchCompany}
                            disabled={isSwitching}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 text-xs font-bold hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        >
                            <Repeat size={14} />
                            Cambiar
                        </button>
                    </div>
                </div>
            )}

            {/* Search + gender filter */}
            <div className="px-4 pt-4 pb-6 sticky top-16 bg-zinc-50/85 dark:bg-zinc-950/85 backdrop-blur-md z-20">
                <div className="max-w-md mx-auto space-y-3">
                    <div className="relative">
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 pointer-events-none">
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
                            <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
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

            {/* Productos Propios */}
            {ownFiltered.length > 0 && (
                <Section title="Productos Propios">
                    {ownFiltered.map((product) => (
                        <ProductCard
                            key={product.uuid}
                            product={product}
                            failed={imgFailed[product.uuid]}
                            onError={() =>
                                setImgFailed((p) => (p[product.uuid] ? p : { ...p, [product.uuid]: true }))
                            }
                            qtyInCart={cart.filter((c) => c.productId === product.id).reduce((s, i) => s + i.quantity, 0)}
                            cta="Ver Detalles"
                            onSelect={() => setActive(product)}
                        />
                    ))}
                </Section>
            )}

            {/* Basic (3D) */}
            {basicsFiltered.length > 0 && (
                <Section title="Basic" badge="3D">
                    {basicsFiltered.map((b) => (
                        <ProductCard
                            key={b.product.uuid}
                            product={b.product}
                            failed={imgFailed[b.product.uuid]}
                            onError={() =>
                                setImgFailed((p) => (p[b.product.uuid] ? p : { ...p, [b.product.uuid]: true }))
                            }
                            basic
                            cta="Personalizar 3D"
                            onSelect={() => setActiveBasic(b)}
                        />
                    ))}
                </Section>
            )}

            {nothing && (
                <div className="px-4 py-16 text-center">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">Sin resultados</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {query ? `No encontramos uniformes para "${query}".` : 'No hay uniformes en esta categoría.'}
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
            )}

            {/* Own product → sizes → cart */}
            {active && (
                <SizeSelector
                    product={active}
                    onCancel={() => setActive(null)}
                    onAdd={(items) => {
                        addItems(
                            { id: active.id, name: active.name, image: active.image, type: active.type },
                            items
                        );
                        setActive(null);
                        openCart();
                    }}
                />
            )}

            {/* Basic product → sizes → 3D → request */}
            {activeBasic && (
                <BasicItemFlow
                    product={activeBasic.product}
                    model={activeBasic.model}
                    logos={companyLogos}
                    onClose={() => setActiveBasic(null)}
                />
            )}
        </div>
    );
}

function Section({
    title,
    badge,
    children
}: {
    title: string;
    badge?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="px-4 mb-8">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-zinc-900 dark:text-zinc-100 mb-4">
                {title}
                {badge && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">
                        <Sparkles size={11} /> {badge}
                    </span>
                )}
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-8">
                {children}
            </div>
        </div>
    );
}

function ProductCard({
    product,
    failed,
    onError,
    qtyInCart,
    cta,
    basic,
    onSelect
}: {
    product: AdminProduct;
    failed?: boolean;
    onError: () => void;
    qtyInCart?: number;
    cta: string;
    basic?: boolean;
    onSelect: () => void;
}) {
    return (
        <div className="overflow-hidden flex flex-col group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="aspect-[4/5] overflow-hidden bg-zinc-100 dark:bg-zinc-800 relative">
                {product.image && !failed ? (
                    <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={onError}
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-600">
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="9" cy="9" r="2" />
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                        </svg>
                        <span className="text-xs font-medium">Sin imagen</span>
                    </div>
                )}
                {basic && (
                    <div className="absolute top-4 left-4 inline-flex items-center gap-1 bg-orange-600 text-white text-[10px] font-bold uppercase px-2 py-1 rounded-full shadow-lg ring-2 ring-white dark:ring-zinc-900">
                        <Sparkles size={11} /> 3D
                    </div>
                )}
                {!!qtyInCart && qtyInCart > 0 && (
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
                    onClick={onSelect}
                    className="mt-auto w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-colors shadow-md shadow-orange-500/20 active:scale-95"
                >
                    {cta}
                </button>
            </div>
        </div>
    );
}
