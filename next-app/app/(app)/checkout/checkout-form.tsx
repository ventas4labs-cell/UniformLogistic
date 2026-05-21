'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import type { CartItem, CustomerForm } from '@/lib/types';
import { useCart } from '@/components/cart-provider';
import { submitOrderAction } from './actions';

function formatItemSize(item: CartItem) {
    if (item.selection.waist) {
        return item.selection.inseam
            ? `C${item.selection.waist}" / L${item.selection.inseam}"`
            : `C${item.selection.waist}"`;
    }
    const genderPrefix = item.selection.gender
        ? item.selection.gender === 'Men'
            ? 'H · '
            : 'M · '
        : '';
    return `${genderPrefix}${item.selection.size || ''}`;
}

interface CheckoutFormProps {
    initial: CustomerForm;
    // Set when admin is checking out on behalf of a customer. Shown as
    // a banner above the form so the admin can verify before submitting.
    actingCompany?: { id: string; name: string } | null;
}

export function CheckoutForm({ initial, actingCompany }: CheckoutFormProps) {
    const router = useRouter();
    const { cart, totalItems, clear } = useCart();
    const [form, setForm] = useState<CustomerForm>(initial);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pending) return;
        if (cart.length === 0) {
            setError('Tu carrito está vacío.');
            return;
        }
        setError(null);

        startTransition(async () => {
            const result = await submitOrderAction(form, cart);
            if (result.error) {
                setError(result.error);
                return;
            }
            if (result.orderRef) {
                clear();
                router.push(`/success?ref=${encodeURIComponent(result.orderRef)}`);
            }
        });
    };

    return (
        <div className="p-4 pb-24 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">Detalles del Pedido</h2>

            {actingCompany && (
                <div className="mb-4 flex items-center gap-3 p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50">
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
                    <Link
                        href="/catalog"
                        className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 text-xs font-bold hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors shrink-0"
                    >
                        Cambiar
                    </Link>
                </div>
            )}

            <div className="shadow-sm bg-white p-6 rounded-2xl border border-zinc-100 mb-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-zinc-900">Resumen del Pedido</h3>
                    <span className="text-sm font-semibold text-orange-600">
                        {totalItems} {totalItems === 1 ? 'pieza' : 'piezas'}
                    </span>
                </div>
                {cart.length === 0 ? (
                    <p className="text-sm text-zinc-500">Tu carrito está vacío.</p>
                ) : (
                    <ul className="divide-y divide-zinc-100">
                        {cart.map((item, idx) => (
                            <li
                                key={idx}
                                className="py-2 flex items-center justify-between gap-3 text-sm"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-zinc-900 truncate">
                                        {item.productName}
                                    </p>
                                    <p className="text-xs text-zinc-500">{formatItemSize(item)}</p>
                                </div>
                                <span className="font-mono font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded">
                                    ×{item.quantity}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                <Link
                    href="/cart"
                    className="mt-4 inline-block text-sm font-semibold text-orange-600 hover:text-orange-700"
                >
                    ← Editar carrito
                </Link>
            </div>

            <form
                onSubmit={handleSubmit}
                className="space-y-4 shadow-sm bg-white p-6 rounded-2xl border border-zinc-100"
            >
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-6">
                    <p className="text-sm text-zinc-600 mb-1">
                        Solicitante: <span className="font-bold text-zinc-900">{form.name}</span>
                    </p>
                    <p className="text-sm text-zinc-600 mb-1">
                        Empresa: <span className="font-bold text-zinc-900">{form.company}</span>
                    </p>
                    <p className="text-xs text-zinc-500">
                        {form.email} • {form.phone}
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                        Orden de Compra (opcional)
                    </label>
                    <input
                        type="text"
                        className="w-full p-3 border rounded-xl"
                        placeholder="Nº de orden de compra interna"
                        value={form.purchaseOrder}
                        onChange={(e) => setForm({ ...form, purchaseOrder: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                        Fecha de Entrega (Estimada: 30 Días Hábiles)
                    </label>
                    <input
                        required
                        type="date"
                        readOnly
                        value={form.date}
                        className="w-full p-3 border rounded-xl bg-zinc-100 text-zinc-500 cursor-not-allowed"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Notas</label>
                    <textarea
                        className="w-full p-3 border rounded-xl h-24"
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                </div>

                {error && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm border border-red-100">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={pending || cart.length === 0}
                    className="w-full bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg mt-8 hover:bg-orange-700 transition-colors disabled:bg-zinc-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {pending ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            Guardando...
                        </>
                    ) : (
                        'Confirmar Pedido'
                    )}
                </button>
            </form>
        </div>
    );
}
