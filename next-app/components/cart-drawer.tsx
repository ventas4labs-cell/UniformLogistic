'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import type { CartItem } from '@/lib/types';
import { useCart } from '@/components/cart-provider';

// ─── Slide-over "pop-up" cart ────────────────────────────────────────
// Global mini-cart mounted once in the (app) layout. Opened from the
// top-right cart icon (TopNav) and auto-opened when a product is added
// from the catalog. Renders straight off the client cart context — cart
// items now carry their own thumbnail + type, so no server round-trip is
// needed. The full /cart + /checkout flow stays as the deep-linked path.

function sizeLabel(item: CartItem): string {
    const { waist, inseam, size } = item.selection;
    if (waist) return inseam ? `${waist}"×${inseam}"` : `Cintura ${waist}"`;
    return size || '—';
}

export function CartDrawer() {
    const { cart, totalItems, removeAt, setQuantity, isOpen, closeCart } = useCart();

    // Close on Escape + lock background scroll while open.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeCart();
        };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [isOpen, closeCart]);

    return (
        <div
            className={`fixed inset-0 z-[60] ${isOpen ? '' : 'pointer-events-none'}`}
            aria-hidden={!isOpen}
        >
            {/* Backdrop */}
            <div
                onClick={closeCart}
                className={`absolute inset-0 bg-zinc-950/50 backdrop-blur-sm transition-opacity duration-300 ${
                    isOpen ? 'opacity-100' : 'opacity-0'
                }`}
            />

            {/* Panel */}
            <aside
                role="dialog"
                aria-modal="true"
                aria-label="Carrito"
                className={`absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-zinc-950 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Header */}
                <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                            <ShoppingBag size={18} />
                        </div>
                        <div>
                            <h2 className="font-extrabold text-lg leading-none text-zinc-900 dark:text-zinc-100">
                                Tu carrito
                            </h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {totalItems} pieza{totalItems === 1 ? '' : 's'} ·{' '}
                                {cart.length} línea{cart.length === 1 ? '' : 's'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={closeCart}
                        aria-label="Cerrar carrito"
                        className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 active:scale-90 transition-all"
                    >
                        <X size={20} />
                    </button>
                </header>

                {/* Body */}
                {cart.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                        <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 dark:text-zinc-600 mb-4">
                            <ShoppingBag size={28} />
                        </div>
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100">
                            Tu carrito está vacío
                        </h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-6">
                            Agrega uniformes desde el catálogo para empezar tu pedido.
                        </p>
                        <Link
                            href="/catalog"
                            onClick={closeCart}
                            className="px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md shadow-orange-500/20 transition-colors"
                        >
                            Ver catálogo
                        </Link>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                        {cart.map((item, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-3 p-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800"
                            >
                                {/* Thumbnail */}
                                <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                                    {item.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={item.imageUrl}
                                            alt={item.productName}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <ShoppingBag
                                            size={20}
                                            className="text-zinc-300 dark:text-zinc-600"
                                        />
                                    )}
                                </div>

                                {/* Name + size */}
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                                        {item.productName}
                                    </p>
                                    <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                                        {sizeLabel(item)}
                                    </span>
                                </div>

                                {/* Quantity stepper */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => setQuantity(index, item.quantity - 1)}
                                        aria-label="Disminuir"
                                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-orange-600 hover:border-orange-300 active:scale-90 transition-all"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <span className="w-6 text-center font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                        {item.quantity}
                                    </span>
                                    <button
                                        onClick={() => setQuantity(index, item.quantity + 1)}
                                        aria-label="Aumentar"
                                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-orange-600 hover:border-orange-300 active:scale-90 transition-all"
                                    >
                                        <Plus size={14} />
                                    </button>
                                    <button
                                        onClick={() => removeAt(index)}
                                        aria-label="Eliminar"
                                        className="ml-0.5 w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-90 transition-all"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer */}
                {cart.length > 0 && (
                    <footer className="border-t border-zinc-200 dark:border-zinc-800 px-5 py-4 space-y-3 bg-white dark:bg-zinc-950">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                                Total de piezas
                            </span>
                            <span className="text-2xl font-extrabold text-orange-600 dark:text-orange-400">
                                {totalItems}
                            </span>
                        </div>
                        <div className="flex gap-2.5">
                            <button
                                onClick={closeCart}
                                className="flex-1 py-3 px-4 rounded-xl border border-zinc-300 dark:border-zinc-700 font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                            >
                                Seguir comprando
                            </button>
                            <Link
                                href="/checkout"
                                onClick={closeCart}
                                className="flex-1 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-center shadow-md shadow-orange-500/20 transition-colors"
                            >
                                Finalizar
                            </Link>
                        </div>
                    </footer>
                )}
            </aside>
        </div>
    );
}
