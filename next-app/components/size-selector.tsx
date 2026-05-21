'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Product, SizeSelection } from '@/lib/types';

interface Props {
    product: Product;
    onAdd: (items: { selection: SizeSelection; quantity: number }[]) => void;
    onCancel: () => void;
}

export function SizeSelector({ product, onAdd, onCancel }: Props) {
    // products-manager saves empty buckets as `[]` rather than dropping them,
    // so a Women-only product still has `sizes.men = []`. An empty array is
    // truthy in JavaScript, which would otherwise (a) show the Hombre/Mujer
    // toggle for a single-gender product and (b) leave `selectedGender`
    // stuck on null. Collapse "has sizes" to a length check.
    const hasMen = (product.sizes.men?.length ?? 0) > 0;
    const hasWomen = (product.sizes.women?.length ?? 0) > 0;

    const [selectedGender, setSelectedGender] = useState<'Men' | 'Women' | null>(
        hasMen && !hasWomen
            ? 'Men'
            : !hasMen && hasWomen
                ? 'Women'
                : hasMen && hasWomen
                    ? 'Men'
                    : null
    );

    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const isShirt = product.type === 'shirt';

    // Reset quantities when gender changes for shirts
    useEffect(() => {
        setQuantities({});
    }, [selectedGender]);

    const updateQuantity = (size: string, delta: number) => {
        setQuantities((prev) => {
            const current = prev[size] || 0;
            const next = Math.max(0, current + delta);
            if (next === 0) {
                const { [size]: _omit, ...rest } = prev;
                return rest;
            }
            return { ...prev, [size]: next };
        });
    };

    const handleInputChange = (size: string, val: string) => {
        if (val === '') {
            setQuantities((prev) => {
                const { [size]: _omit, ...rest } = prev;
                return rest;
            });
            return;
        }
        const num = parseInt(val, 10);
        if (isNaN(num) || num < 0) return;
        setQuantities((prev) => {
            if (num === 0) {
                const { [size]: _omit, ...rest } = prev;
                return rest;
            }
            return { ...prev, [size]: num };
        });
    };

    const totalItems = Object.values(quantities).reduce((a, b) => a + b, 0);

    const handleSubmit = () => {
        const items: { selection: SizeSelection; quantity: number }[] = [];
        for (const [sizeKey, qty] of Object.entries(quantities)) {
            if (qty <= 0) continue;
            if (isShirt) {
                if (selectedGender) {
                    items.push({
                        selection: { gender: selectedGender, size: sizeKey },
                        quantity: qty,
                    });
                }
            } else {
                items.push({
                    selection: { waist: parseInt(sizeKey, 10) },
                    quantity: qty,
                });
            }
        }
        if (items.length > 0) onAdd(items);
    };

    const renderQtyInput = (size: string | number) => {
        const key = String(size);
        const qty = quantities[key] || 0;
        return (
            <div
                key={key}
                className="flex flex-col items-center p-3 bg-zinc-50 rounded-xl border border-zinc-100"
            >
                <span className="text-zinc-900 font-bold mb-2">{size}</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => updateQuantity(key, -1)}
                        className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-zinc-400 hover:text-orange-600 active:scale-95 transition-all"
                        aria-label="Disminuir"
                    >
                        <Minus size={16} />
                    </button>
                    <input
                        type="number"
                        min="0"
                        value={qty === 0 ? '' : qty}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        className="w-12 text-center bg-transparent font-semibold outline-none border-b border-transparent focus:border-orange-500 transition-colors appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="0"
                    />
                    <button
                        onClick={() => updateQuantity(key, 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-zinc-400 hover:text-orange-600 active:scale-95 transition-all"
                        aria-label="Aumentar"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-zinc-900">
                            Seleccionar Tallas
                        </h3>
                        <p className="text-sm text-zinc-500">
                            Ingresa la cantidad para cada talla
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-zinc-400 hover:text-zinc-600 text-2xl"
                        aria-label="Cerrar"
                    >
                        &times;
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                    {isShirt && (
                        <div className="space-y-6">
                            {hasMen && hasWomen && (
                                <div className="flex p-1 bg-zinc-100 rounded-lg max-w-sm mx-auto">
                                    <button
                                        onClick={() => setSelectedGender('Men')}
                                        className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${selectedGender === 'Men' ? 'bg-white shadow text-orange-600' : 'text-zinc-500'}`}
                                    >
                                        Hombre
                                    </button>
                                    <button
                                        onClick={() => setSelectedGender('Women')}
                                        className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${selectedGender === 'Women' ? 'bg-white shadow text-orange-600' : 'text-zinc-500'}`}
                                    >
                                        Mujer
                                    </button>
                                </div>
                            )}
                            {selectedGender && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {(selectedGender === 'Men'
                                        ? product.sizes.men
                                        : product.sizes.women
                                    )?.map((s) => renderQtyInput(s))}
                                </div>
                            )}
                        </div>
                    )}

                    {!isShirt && (
                        <div className="space-y-6">
                            <h4 className="font-semibold text-zinc-700">Cintura</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {product.sizes.waist?.map((w) => renderQtyInput(w))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-100">
                    <button
                        disabled={totalItems === 0}
                        onClick={handleSubmit}
                        className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${totalItems > 0 ? 'bg-orange-600 hover:bg-orange-700' : 'bg-zinc-300 cursor-not-allowed'}`}
                    >
                        <span>Agregar al Pedido</span>
                        {totalItems > 0 && (
                            <span className="bg-white/20 px-2 py-0.5 rounded-md text-sm">
                                {totalItems} artículos
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
