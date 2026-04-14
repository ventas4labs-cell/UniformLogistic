'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import type { CartItem } from '@/lib/types';
import { useCart } from '@/components/cart-provider';

interface Props {
    productIndex: Record<string, { name: string; image: string }>;
}

function formatSize(item: CartItem) {
    if (item.selection.waist) return `C${item.selection.waist}"`;
    return item.selection.size || '';
}

export function CartReview({ productIndex }: Props) {
    const { cart, totalItems, removeAt, setQuantity } = useCart();

    const grouped = useMemo(() => {
        const groups: Record<
            string,
            { product: { name: string; image: string } | undefined; items: { item: CartItem; index: number }[] }
        > = {};
        cart.forEach((item, index) => {
            if (!groups[item.productId]) {
                groups[item.productId] = {
                    product: productIndex[item.productId],
                    items: [],
                };
            }
            groups[item.productId].items.push({ item, index });
        });
        return Object.entries(groups);
    }, [cart, productIndex]);

    if (cart.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
                <div className="bg-orange-100 p-6 rounded-full mb-4">
                    <span className="text-4xl">🛒</span>
                </div>
                <h2 className="text-2xl font-bold text-zinc-800 mb-2">Tu Carrito está Vacío</h2>
                <p className="text-zinc-500 mb-6">Comienza a agregar uniformes a tu pedido.</p>
                <Link
                    href="/catalog"
                    className="bg-orange-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-orange-700 transition-colors"
                >
                    Ver Catálogo
                </Link>
            </div>
        );
    }

    return (
        <div className="pb-28 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 px-4">Revisar Pedido</h2>

            <div className="space-y-6 px-4">
                {grouped.map(([productId, group]) => (
                    <div key={productId} className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
                        <div className="p-4 bg-zinc-50 border-b border-zinc-100 flex gap-4 items-center">
                            {group.product?.image && (
                                <img
                                    src={group.product.image}
                                    alt={group.product.name}
                                    className="w-16 h-16 object-cover rounded-lg bg-white border border-zinc-200"
                                />
                            )}
                            <div className="flex-1">
                                <h3 className="font-bold text-zinc-900 text-lg">
                                    {group.product?.name || productId}
                                </h3>
                                <p className="text-sm text-zinc-500">
                                    {group.items.reduce((a, b) => a + b.item.quantity, 0)} piezas en total
                                </p>
                            </div>
                        </div>

                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white">
                            {group.items.map(({ item, index }) => (
                                <div
                                    key={index}
                                    className="flex justify-between items-center bg-zinc-50 p-2 rounded-lg border border-zinc-100"
                                >
                                    <span className="text-sm font-semibold text-zinc-700 px-1">
                                        {formatSize(item)}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setQuantity(index, item.quantity - 1)}
                                            aria-label="Disminuir"
                                            className="w-7 h-7 flex items-center justify-center bg-white rounded-md border border-zinc-200 text-zinc-500 hover:text-orange-600 active:scale-95 transition-all"
                                        >
                                            <Minus size={14} />
                                        </button>
                                        <span className="font-mono font-bold text-zinc-900 w-8 text-center text-sm">
                                            {item.quantity}
                                        </span>
                                        <button
                                            onClick={() => setQuantity(index, item.quantity + 1)}
                                            aria-label="Aumentar"
                                            className="w-7 h-7 flex items-center justify-center bg-white rounded-md border border-zinc-200 text-zinc-500 hover:text-orange-600 active:scale-95 transition-all"
                                        >
                                            <Plus size={14} />
                                        </button>
                                        <button
                                            onClick={() => removeAt(index)}
                                            aria-label="Eliminar"
                                            className="ml-2 text-zinc-400 hover:text-red-500 active:scale-95 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-4 pb-8 shadow-2xl z-20">
                <div className="max-w-md mx-auto">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-zinc-600">Total Piezas</span>
                        <span className="text-2xl font-bold text-orange-600">{totalItems}</span>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            href="/catalog"
                            className="flex-1 py-3 px-4 border border-zinc-300 rounded-xl font-semibold text-zinc-700 text-center"
                        >
                            Agregar Más
                        </Link>
                        <Link
                            href="/checkout"
                            className="flex-1 py-3 px-4 bg-orange-600 text-white rounded-xl font-bold shadow-md hover:bg-orange-700 text-center"
                        >
                            Finalizar
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
