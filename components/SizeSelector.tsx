import React, { useState, useEffect } from 'react';
import { Product, SizeSelection } from '../types';
import { Plus, Minus } from 'lucide-react';

interface SizeSelectorProps {
    product: Product;
    onAdd: (items: { selection: SizeSelection; quantity: number }[]) => void;
    onCancel: () => void;
}

const SizeSelector: React.FC<SizeSelectorProps> = ({ product, onAdd, onCancel }) => {
    // Common State
    const [selectedGender, setSelectedGender] = useState<'Men' | 'Women' | null>(
        product.sizes.men && !product.sizes.women ? 'Men' :
            !product.sizes.men && product.sizes.women ? 'Women' : null
    );

    // Map of size -> quantity
    // For shirts: key is the size string (e.g. "S", "M")
    // For pants: key is the waist size string (e.g. "30", "32")
    const [quantities, setQuantities] = useState<Record<string, number>>({});

    const isShirt = product.type === 'shirt';

    // Reset quantities when gender changes for shirts
    useEffect(() => {
        setQuantities({});
    }, [selectedGender]);

    const updateQuantity = (size: string, delta: number) => {
        setQuantities(prev => {
            const current = prev[size] || 0;
            const next = Math.max(0, current + delta);
            if (next === 0) {
                const { [size]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [size]: next };
        });
    };

    const handleInputChange = (size: string, val: string) => {
        const num = parseInt(val);
        if (isNaN(num) || num < 0) return;

        setQuantities(prev => {
            if (num === 0) {
                const { [size]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [size]: num };
        });
    };

    const getTotalItems = () => (Object.values(quantities) as number[]).reduce((a, b) => a + b, 0);

    const handleSubmit = () => {
        const itemsToAdd: { selection: SizeSelection; quantity: number }[] = [];

        (Object.entries(quantities) as [string, number][]).forEach(([sizeKey, qty]) => {
            if (qty <= 0) return;

            if (isShirt) {
                if (selectedGender) {
                    itemsToAdd.push({
                        selection: { gender: selectedGender, size: sizeKey },
                        quantity: qty
                    });
                }
            } else {
                // Pants - sizeKey is waist
                itemsToAdd.push({
                    selection: { waist: parseInt(sizeKey) },
                    quantity: qty
                });
            }
        });

        if (itemsToAdd.length > 0) {
            onAdd(itemsToAdd);
        }
    };

    const renderQuantityInput = (size: string | number) => {
        const sizeKey = String(size);
        const qty = quantities[sizeKey] || 0;

        return (
            <div key={sizeKey} className="flex flex-col items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-gray-900 font-bold mb-2">{size}</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => updateQuantity(sizeKey, -1)}
                        className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-400 hover:text-orange-600 active:scale-95 transition-all"
                    >
                        <Minus size={16} />
                    </button>
                    <input
                        type="number"
                        min="0"
                        value={qty === 0 ? '' : qty}
                        onChange={(e) => handleInputChange(sizeKey, e.target.value)}
                        className="w-12 text-center bg-transparent font-semibold outline-none border-b border-transparent focus:border-orange-500 transition-colors appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="0"
                    />
                    <button
                        onClick={() => updateQuantity(sizeKey, 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-400 hover:text-orange-600 active:scale-95 transition-all"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto flex flex-col">

                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Seleccionar Tallas</h3>
                        <p className="text-sm text-gray-500">Ingresa la cantidad para cada talla</p>
                    </div>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                    {/* --- Shirt Logic --- */}
                    {isShirt && (
                        <div className="space-y-6">
                            {/* Gender Toggle */}
                            {product.sizes.men && product.sizes.women && (
                                <div className="flex p-1 bg-gray-100 rounded-lg max-w-sm mx-auto">
                                    <button
                                        onClick={() => setSelectedGender('Men')}
                                        className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${selectedGender === 'Men' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}
                                    >
                                        Hombre
                                    </button>
                                    <button
                                        onClick={() => setSelectedGender('Women')}
                                        className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${selectedGender === 'Women' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}
                                    >
                                        Mujer
                                    </button>
                                </div>
                            )}

                            {/* Size Grid */}
                            {selectedGender && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {(selectedGender === 'Men' ? product.sizes.men : product.sizes.women)?.map(size => (
                                        renderQuantityInput(size)
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- Pant Logic --- */}
                    {!isShirt && (
                        <div className="space-y-6">
                            <h4 className="font-semibold text-gray-700">Cintura</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {product.sizes.waist?.map(w => (
                                    renderQuantityInput(w)
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* --- Footer --- */}
                <div className="mt-6 pt-4 border-t border-gray-100">
                    <button
                        disabled={getTotalItems() === 0}
                        onClick={handleSubmit}
                        className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${getTotalItems() > 0 ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-300 cursor-not-allowed'
                            }`}
                    >
                        <span>Agregar al Pedido</span>
                        {getTotalItems() > 0 && (
                            <span className="bg-white/20 px-2 py-0.5 rounded-md text-sm">
                                {getTotalItems()} artículos
                            </span>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default SizeSelector;