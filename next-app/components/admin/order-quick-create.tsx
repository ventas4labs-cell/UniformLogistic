'use client';

import { useState } from 'react';
import {
    Loader2,
    X,
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    ImageIcon,
    CheckCircle2,
    Search
} from 'lucide-react';
import type { Company } from '@/lib/services/companies';
import type { AdminProduct } from '@/lib/services/products';
import type { CartItem, SizeSelection } from '@/lib/types';
import {
    fetchCompanyCatalogAction,
    createQuickOrderAction
} from '@/app/(admin)/admin/_quick-create-actions';

interface SizeOption {
    label: string;
    selection: SizeSelection;
}

// Build the pickable sizes for a product from its size buckets. Pants
// use waist (numbers); shirts use men/women labels with a gender prefix
// matching selectionToSizeString. Falls back to a single "Único" option.
function sizeOptions(p: AdminProduct): SizeOption[] {
    const out: SizeOption[] = [];
    const waist = p.sizes.waist || [];
    if (waist.length > 0) {
        for (const w of waist) out.push({ label: `C${w}"`, selection: { waist: w } });
    } else {
        for (const s of p.sizes.men || [])
            out.push({ label: `H · ${s}`, selection: { gender: 'Men', size: s } });
        for (const s of p.sizes.women || [])
            out.push({ label: `M · ${s}`, selection: { gender: 'Women', size: s } });
    }
    if (out.length === 0) out.push({ label: 'Único', selection: {} });
    return out;
}

interface CartLine {
    key: string;
    productId: string;
    productName: string;
    label: string;
    selection: SizeSelection;
    quantity: number;
    image: string;
}

interface Props {
    companies: Company[];
    onClose: () => void;
}

// Simplified order builder shown as a popup. Pick a company, then add
// products (with pictures) by size + quantity. Submits straight to the
// order service — no catalog → cart → checkout navigation.
export function OrderQuickCreate({ companies, onClose }: Props) {
    const [companyId, setCompanyId] = useState('');
    const [catalog, setCatalog] = useState<AdminProduct[] | null>(null);
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<CartLine[]>([]);
    const [notes, setNotes] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdRef, setCreatedRef] = useState<string | null>(null);

    const pickCompany = async (id: string) => {
        setCompanyId(id);
        setCatalog(null);
        setCart([]);
        setError(null);
        if (!id) return;
        setLoadingCatalog(true);
        try {
            const products = await fetchCompanyCatalogAction(id);
            setCatalog(products.filter((p) => p.isActive));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al cargar el catálogo');
        } finally {
            setLoadingCatalog(false);
        }
    };

    const addLine = (p: AdminProduct, opt: SizeOption, qty: number) => {
        if (qty <= 0) return;
        const key = `${p.id}|${opt.label}`;
        setCart((prev) => {
            const existing = prev.find((l) => l.key === key);
            if (existing) {
                return prev.map((l) =>
                    l.key === key ? { ...l, quantity: l.quantity + qty } : l
                );
            }
            return [
                ...prev,
                {
                    key,
                    productId: p.id,
                    productName: p.name,
                    label: opt.label,
                    selection: opt.selection,
                    quantity: qty,
                    image: p.image
                }
            ];
        });
    };

    const setLineQty = (key: string, qty: number) => {
        setCart((prev) =>
            qty <= 0
                ? prev.filter((l) => l.key !== key)
                : prev.map((l) => (l.key === key ? { ...l, quantity: qty } : l))
        );
    };

    const totalPieces = cart.reduce((s, l) => s + l.quantity, 0);

    const visibleCatalog = (catalog || []).filter((p) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
            p.name.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q) ||
            (p.fabricType || '').toLowerCase().includes(q)
        );
    });

    const submit = async () => {
        if (!companyId) {
            setError('Elegí una empresa.');
            return;
        }
        if (cart.length === 0) {
            setError('Agregá al menos un producto.');
            return;
        }
        setSaving(true);
        setError(null);
        const items: CartItem[] = cart.map((l) => ({
            productId: l.productId,
            productName: l.productName,
            selection: l.selection,
            quantity: l.quantity
        }));
        try {
            const res = await createQuickOrderAction(companyId, items, {
                notes: notes.trim() || undefined,
                deliveryDate: deliveryDate || undefined
            });
            if (res.error) {
                setError(res.error);
                return;
            }
            setCreatedRef(res.orderRef || '');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al crear el pedido');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <ShoppingCart size={20} className="text-orange-600 dark:text-orange-400" />
                        Nuevo pedido
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                {createdRef !== null ? (
                    <div className="p-10 text-center space-y-4">
                        <div className="mx-auto w-14 h-14 rounded-full bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 flex items-center justify-center">
                            <CheckCircle2 size={28} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 dark:text-zinc-100">
                                Pedido creado{createdRef ? `: ${createdRef}` : ''}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                                {totalPieces} pieza{totalPieces === 1 ? '' : 's'} en el pedido.
                            </p>
                        </div>
                        <div className="flex gap-3 justify-center">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-lg font-bold bg-orange-600 text-white hover:bg-orange-700"
                            >
                                Cerrar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setCreatedRef(null);
                                    setCart([]);
                                    setNotes('');
                                    setDeliveryDate('');
                                }}
                                className="px-5 py-2.5 rounded-lg font-bold border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                            >
                                Crear otro
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 border-b border-gray-100 dark:border-zinc-800">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1">
                                    Empresa
                                </label>
                                <select
                                    value={companyId}
                                    onChange={(e) => pickCompany(e.target.value)}
                                    className="w-full p-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-orange-500 outline-none"
                                >
                                    <option value="">Elegí una empresa…</option>
                                    {companies.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {companyId && catalog && (
                                <div className="sm:self-end">
                                    <div className="relative">
                                        <Search
                                            size={15}
                                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                                        />
                                        <input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Buscar producto…"
                                            className="pl-8 pr-3 py-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-orange-500 outline-none w-full sm:w-56"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-5">
                            {!companyId ? (
                                <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-10">
                                    Elegí una empresa para ver su catálogo.
                                </p>
                            ) : loadingCatalog ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-gray-500 dark:text-zinc-400">
                                    <Loader2 className="animate-spin" size={18} /> Cargando catálogo…
                                </div>
                            ) : visibleCatalog.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-10">
                                    {catalog && catalog.length === 0
                                        ? 'Esta empresa no tiene productos asignados.'
                                        : 'Ningún producto coincide con la búsqueda.'}
                                </p>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {visibleCatalog.map((p) => (
                                        <ProductCard key={p.uuid} product={p} onAdd={addLine} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Cart + submit */}
                        <div className="border-t border-gray-200 dark:border-zinc-800 p-4 bg-gray-50 dark:bg-zinc-900/60 max-h-[40vh] overflow-y-auto">
                            {cart.length === 0 ? (
                                <p className="text-sm text-gray-400 dark:text-zinc-500 italic text-center py-2">
                                    Agregá productos para armar el pedido.
                                </p>
                            ) : (
                                <div className="space-y-1.5 mb-3">
                                    {cart.map((l) => (
                                        <div
                                            key={l.key}
                                            className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-lg px-2 py-1.5 border border-gray-200 dark:border-zinc-800"
                                        >
                                            {l.image ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={l.image}
                                                    alt=""
                                                    className="w-8 h-8 rounded object-cover shrink-0"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                                    <ImageIcon size={14} className="text-gray-300 dark:text-zinc-600" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">
                                                    {l.productName}
                                                </div>
                                                <div className="text-[11px] text-gray-500 dark:text-zinc-400 font-mono">
                                                    {l.label}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setLineQty(l.key, l.quantity - 1)}
                                                    className="w-6 h-6 rounded bg-gray-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700"
                                                >
                                                    <Minus size={12} />
                                                </button>
                                                <span className="w-8 text-center font-bold text-sm">
                                                    {l.quantity}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setLineQty(l.key, l.quantity + 1)}
                                                    className="w-6 h-6 rounded bg-gray-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700"
                                                >
                                                    <Plus size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLineQty(l.key, 0)}
                                                    className="w-6 h-6 rounded text-gray-400 hover:text-red-600 flex items-center justify-center"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                                <input
                                    type="date"
                                    value={deliveryDate}
                                    onChange={(e) => setDeliveryDate(e.target.value)}
                                    title="Fecha de entrega (opcional)"
                                    className="p-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Nota (opcional)"
                                    className="p-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-2.5 rounded-lg text-sm border border-red-100 dark:border-red-900/50 mb-3">
                                    {error}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={submit}
                                disabled={saving || cart.length === 0 || !companyId}
                                className="w-full py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:bg-gray-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <ShoppingCart size={18} />}
                                Crear pedido{totalPieces > 0 ? ` · ${totalPieces} pzas` : ''}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function ProductCard({
    product,
    onAdd
}: {
    product: AdminProduct;
    onAdd: (p: AdminProduct, opt: SizeOption, qty: number) => void;
}) {
    const options = sizeOptions(product);
    const [optIdx, setOptIdx] = useState(0);
    const [qty, setQty] = useState(1);

    return (
        <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 flex flex-col">
            <div className="aspect-square bg-gray-50 dark:bg-zinc-800/50 flex items-center justify-center">
                {product.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <ImageIcon size={28} className="text-gray-300 dark:text-zinc-600" />
                )}
            </div>
            <div className="p-2.5 flex flex-col gap-2 flex-1">
                <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">
                        {product.name}
                    </div>
                    {product.fabricType && (
                        <div className="text-[11px] text-gray-500 dark:text-zinc-400 truncate">
                            {product.fabricType}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1.5 mt-auto">
                    <select
                        value={optIdx}
                        onChange={(e) => setOptIdx(Number(e.target.value))}
                        className="flex-1 min-w-0 p-1.5 border border-gray-200 dark:border-zinc-700 rounded text-xs bg-white dark:bg-zinc-900 focus:ring-1 focus:ring-orange-500 outline-none"
                    >
                        {options.map((o, i) => (
                            <option key={o.label} value={i}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    <input
                        type="number"
                        min={1}
                        value={qty}
                        onChange={(e) =>
                            setQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                        className="w-12 p-1.5 border border-gray-200 dark:border-zinc-700 rounded text-xs text-center bg-white dark:bg-zinc-900 focus:ring-1 focus:ring-orange-500 outline-none"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => onAdd(product, options[optIdx], qty)}
                    className="w-full py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 text-xs font-bold hover:bg-orange-100 dark:hover:bg-orange-950/50 flex items-center justify-center gap-1"
                >
                    <Plus size={14} /> Agregar
                </button>
            </div>
        </div>
    );
}
