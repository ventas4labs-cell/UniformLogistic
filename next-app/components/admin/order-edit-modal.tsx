'use client';

import { useMemo, useState, useTransition } from 'react';
import { X, Plus, Trash2, Loader2, Search } from 'lucide-react';
import type { Order } from '@/lib/types';
import type { AdminProduct } from '@/lib/services/products';
import { updateOrderAction } from '@/app/(admin)/admin/orders/actions';

// Local working-copy of an order item. Existing items carry the row id;
// newly added items leave it undefined so the server-side reconcile
// knows to insert them.
interface DraftItem {
    id?: string;
    productCode: string;
    productName: string;
    size: string;
    quantity: number;
    productUuid: string | null;
}

function isoDate(date: string | undefined | null): string {
    if (!date) return '';
    // Supabase returns either an ISO datetime or a date string;
    // normalize to YYYY-MM-DD for the <input type="date"> control.
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function listSizesForProduct(p: AdminProduct): string[] {
    const sizes: string[] = [];
    if (p.sizes.men?.length) sizes.push(...p.sizes.men.map((s) => `Hombre · ${s}`));
    if (p.sizes.women?.length) sizes.push(...p.sizes.women.map((s) => `Mujer · ${s}`));
    if (p.sizes.waist?.length) {
        for (const w of p.sizes.waist) {
            if (p.sizes.inseam?.length) {
                for (const l of p.sizes.inseam) sizes.push(`C${w}" / L${l}"`);
            } else {
                sizes.push(`C${w}"`);
            }
        }
    }
    return sizes;
}

export function OrderEditModal({
    order,
    products,
    onClose,
    onSaved
}: {
    order: Order;
    products: AdminProduct[];
    onClose: () => void;
    onSaved: (next: Order) => void;
}) {
    const [purchaseOrder, setPurchaseOrder] = useState(order.purchaseOrder || '');
    const [deliveryDate, setDeliveryDate] = useState(isoDate(order.deliveryDate));
    const [notes, setNotes] = useState(order.notes || '');
    const [items, setItems] = useState<DraftItem[]>(() =>
        order.items.map((it, idx) => ({
            // The Order type doesn't expose the row id, so existing
            // items can't be matched back to their DB row from this
            // modal. We use a stable synthetic id derived from index +
            // payload so React keys are stable and the server reconcile
            // sees them as "existing" via uuid lookup. The server-side
            // action receives undefined for `id`, so on save these are
            // treated as deletes + inserts (full replacement). This is
            // intentional: the API surface today doesn't return item
            // ids, and a delete-then-insert is simpler than threading
            // ids through every layer. See note in commit message.
            id: `${idx}-${it.productId}-${it.selection.size || ''}`,
            productCode: it.productId,
            productName: it.productName,
            size: it.selection.size || '',
            quantity: it.quantity,
            productUuid: null
        }))
    );

    // Product picker state
    const [pickerSearch, setPickerSearch] = useState('');
    const [pickerProductId, setPickerProductId] = useState<string>('');
    const [pickerSize, setPickerSize] = useState<string>('');
    const [pickerQty, setPickerQty] = useState<number>(1);

    const [saving, startSaving] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const filteredProducts = useMemo(() => {
        const term = pickerSearch.trim().toLowerCase();
        if (!term) return products;
        return products.filter(
            (p) =>
                p.name.toLowerCase().includes(term) ||
                p.id.toLowerCase().includes(term)
        );
    }, [products, pickerSearch]);

    const selectedProduct = useMemo(
        () => products.find((p) => p.uuid === pickerProductId),
        [products, pickerProductId]
    );

    const sizesForPicker = selectedProduct ? listSizesForProduct(selectedProduct) : [];

    const handleAddItem = () => {
        if (!selectedProduct || !pickerSize || pickerQty <= 0) return;
        setItems((prev) => [
            ...prev,
            {
                productCode: selectedProduct.id,
                productName: selectedProduct.name,
                size: pickerSize,
                quantity: pickerQty,
                productUuid: selectedProduct.uuid
            }
        ]);
        // Reset picker but keep the product selected so the user can
        // quickly add multiple sizes of the same item.
        setPickerSize('');
        setPickerQty(1);
    };

    const handleRemove = (idx: number) => {
        setItems((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleQtyChange = (idx: number, qty: number) => {
        setItems((prev) =>
            prev.map((it, i) => (i === idx ? { ...it, quantity: qty } : it))
        );
    };

    const handleSave = () => {
        if (!order.uuid) {
            setError('No se puede actualizar esta orden (sin UUID).');
            return;
        }
        if (items.length === 0) {
            setError('La orden debe tener al menos un artículo.');
            return;
        }
        setError(null);
        // Order.uuid is typed optional on the shared Order interface so
        // it can be omitted in customer-facing snapshots. The edit
        // modal only ever opens for admin-loaded orders (which always
        // carry the uuid), but TS doesn't know that — guard explicitly.
        if (!order.uuid) {
            setError('Esta orden no se puede editar (sin identificador interno).');
            return;
        }
        const orderUuid = order.uuid;
        startSaving(async () => {
            try {
                // Server-side reconcile: any item with an id is updated;
                // items without an id are inserted; missing ids are
                // deleted. See note in DraftItem — we currently treat
                // every existing item as id-less, so the server does a
                // wholesale replacement of the items list. That keeps
                // the API simple at the cost of churning rows even when
                // nothing changed.
                await updateOrderAction(
                    orderUuid,
                    {
                        purchaseOrder: purchaseOrder.trim() || null,
                        deliveryDate: deliveryDate || null,
                        notes: notes.trim() || null
                    },
                    items.map((i) => ({
                        productCode: i.productCode,
                        productName: i.productName,
                        size: i.size,
                        quantity: i.quantity,
                        productUuid: i.productUuid
                    }))
                );
                onSaved({
                    ...order,
                    purchaseOrder: purchaseOrder.trim(),
                    deliveryDate,
                    notes: notes.trim(),
                    items: items.map((i) => ({
                        productId: i.productCode,
                        productName: i.productName,
                        selection: { size: i.size },
                        quantity: i.quantity
                    }))
                });
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Error al guardar');
            }
        });
    };

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
                            Editar Orden{' '}
                            <span className="font-mono text-orange-600 dark:text-orange-400">
                                {order.id}
                            </span>
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-zinc-400">
                            {order.companyName || '—'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto p-5 space-y-5 flex-1">
                    {/* Header fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-400 mb-1">
                                Orden de compra
                            </label>
                            <input
                                type="text"
                                value={purchaseOrder}
                                onChange={(e) => setPurchaseOrder(e.target.value)}
                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="PO-001"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-400 mb-1">
                                Fecha entrega
                            </label>
                            <input
                                type="date"
                                value={deliveryDate}
                                onChange={(e) => setDeliveryDate(e.target.value)}
                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-400 mb-1">
                            Notas
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            placeholder="Instrucciones, detalles del cliente..."
                        />
                    </div>

                    {/* Items */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-400 mb-2">
                            Artículos ({items.length})
                        </h4>
                        {items.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-zinc-500 italic px-2">
                                Sin artículos. Agrega al menos uno antes de guardar.
                            </p>
                        ) : (
                            <div className="space-y-1.5">
                                {items.map((it, idx) => (
                                    <div
                                        key={it.id || `new-${idx}`}
                                        className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 dark:text-zinc-100 truncate">
                                                {it.productName}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                                                {it.productCode} · {it.size || '—'}
                                            </p>
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            value={it.quantity}
                                            onChange={(e) =>
                                                handleQtyChange(
                                                    idx,
                                                    Math.max(1, parseInt(e.target.value, 10) || 1)
                                                )
                                            }
                                            className="w-20 p-1.5 border rounded text-sm text-center focus:ring-2 focus:ring-orange-500 outline-none"
                                        />
                                        <button
                                            onClick={() => handleRemove(idx)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                                            title="Eliminar artículo"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add new item */}
                    <div className="border border-dashed border-gray-200 dark:border-zinc-700 rounded-lg p-4 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-400">
                            Agregar artículo
                        </h4>
                        <div className="relative">
                            <Search
                                className="absolute left-3 top-2.5 text-gray-400 dark:text-zinc-500"
                                size={16}
                            />
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                value={pickerSearch}
                                onChange={(e) => setPickerSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <select
                            value={pickerProductId}
                            onChange={(e) => {
                                setPickerProductId(e.target.value);
                                setPickerSize('');
                            }}
                            className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-zinc-900"
                        >
                            <option value="">— Selecciona un producto —</option>
                            {filteredProducts.map((p) => (
                                <option key={p.uuid} value={p.uuid}>
                                    {p.id} · {p.name}
                                </option>
                            ))}
                        </select>
                        <div className="grid grid-cols-3 gap-2">
                            <select
                                value={pickerSize}
                                onChange={(e) => setPickerSize(e.target.value)}
                                disabled={!selectedProduct || sizesForPicker.length === 0}
                                className="col-span-2 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none disabled:bg-gray-50 dark:disabled:bg-zinc-800/50 bg-white dark:bg-zinc-900"
                            >
                                <option value="">— Talla —</option>
                                {sizesForPicker.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="number"
                                min="1"
                                value={pickerQty}
                                onChange={(e) =>
                                    setPickerQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                                }
                                className="p-2 border rounded-lg text-sm text-center focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="Cant."
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleAddItem}
                            disabled={!selectedProduct || !pickerSize || pickerQty <= 0}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-orange-600 text-white rounded-lg font-bold text-sm hover:bg-orange-700 disabled:bg-gray-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed"
                        >
                            <Plus size={16} /> Agregar al pedido
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/50">
                            {error}
                        </div>
                    )}
                </div>

                <div className="flex gap-3 p-5 border-t border-gray-100 dark:border-zinc-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || items.length === 0}
                        className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:bg-gray-300 dark:disabled:bg-zinc-700 flex items-center justify-center gap-2"
                    >
                        {saving && <Loader2 className="animate-spin" size={16} />}
                        Guardar cambios
                    </button>
                </div>
            </div>

        </div>
    );
}
