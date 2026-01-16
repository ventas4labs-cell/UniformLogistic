import React, { useMemo } from 'react';
import { CartItem, Product } from '../types';
import { PRODUCTS } from '../constants';
import { Trash2, Edit2 } from 'lucide-react';

interface CartProps {
  cart: CartItem[];
  onRemove: (index: number) => void;
  onCheckout: () => void;
  onContinueShopping: () => void;
}

const Cart: React.FC<CartProps> = ({ cart, onRemove, onCheckout, onContinueShopping }) => {
  const totalItems = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);

  // Helper to format size string
  const formatSize = (item: CartItem) => {
    if (item.selection.waist) {
      return `C${item.selection.waist}"`;
    }
    return item.selection.size || '';
  };

  // Group items by productId
  const groupedItems = useMemo(() => {
    const groups: Record<string, { product: Product | undefined, items: CartItem[] }> = {};

    cart.forEach((item) => {
      if (!groups[item.productId]) {
        groups[item.productId] = {
          product: PRODUCTS.find(p => p.id === item.productId),
          items: []
        };
      }
      groups[item.productId].items.push(item);
    });

    return Object.values(groups);
  }, [cart]);

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <div className="bg-orange-100 p-6 rounded-full mb-4">
          <span className="text-4xl">🛒</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Tu Carrito está Vacío</h2>
        <p className="text-gray-500 mb-6">Comienza a agregar uniformes a tu pedido.</p>
        <button
          onClick={onContinueShopping}
          className="bg-orange-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-orange-700 transition-colors"
        >
          Ver Catálogo
        </button>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <h2 className="text-2xl font-bold mb-6 px-4">Revisar Pedido</h2>

      <div className="space-y-6 px-4">
        {groupedItems.map((group, groupIdx) => (
          <div key={groupIdx} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header with Product Info */}
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex gap-4 items-center">
              <img
                src={group.product?.image || ''}
                alt={group.product?.name}
                className="w-16 h-16 object-cover rounded-lg bg-white border border-gray-200"
              />
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg">{group.product?.name}</h3>
                <p className="text-sm text-gray-500">{group.items.reduce((a, b) => a + b.quantity, 0)} piezas en total</p>
              </div>
            </div>

            {/* Compact Size Grid */}
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white">
              {group.items.map((item, idx) => {
                // Find original index for removal
                const originalIndex = cart.indexOf(item);
                return (
                  <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200 text-sm">
                        {item.quantity}
                      </span>
                      <span className="text-sm font-medium text-gray-600">{formatSize(item)}</span>
                    </div>
                    <button
                      onClick={() => onRemove(originalIndex)}
                      className="text-gray-400 hover:text-red-500 active:scale-95 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky Bottom Summary */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-8 shadow-2xl z-20">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600">Total Piezas</span>
            <span className="text-2xl font-bold text-orange-600">{totalItems}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onContinueShopping}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-xl font-semibold text-gray-700"
            >
              Agregar Más
            </button>
            <button
              onClick={onCheckout}
              className="flex-1 py-3 px-4 bg-orange-600 text-white rounded-xl font-bold shadow-md hover:bg-orange-700"
            >
              Finalizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;