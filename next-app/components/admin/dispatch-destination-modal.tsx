'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, X, Truck, Boxes } from 'lucide-react';
import type { Order } from '@/lib/types';
import {
    dispatchOrderAction,
    type DispatchDestination
} from '@/app/(admin)/admin/empaque/actions';

interface Props {
    order: Order;
    /** Already-dispatched qty per order_items.id (delivery ledger). */
    dispatched: Map<string, number>;
    /** Already-added-to-stock qty per order_items.id (stock ledger). */
    stocked: Map<string, number>;
    onClose: () => void;
    /** Lines actually applied, tagged with their destination, so the
     *  board can bump the right optimistic totals. */
    onApplied: (
        lines: { orderItemId: string; quantity: number; destination: DispatchDestination }[]
    ) => void;
}

interface LineState {
    id: string;
    name: string;
    size: string;
    ordered: number;
    alreadyOut: number;
    remaining: number;
    destination: DispatchDestination;
    text: string;
}

// One "Despachar" action: each order line's pieces are routed to entrega
// OR the customer's stock. Remaining is the COMBINED cap (ordered minus
// everything already dispatched or stocked), so a piece can only ever go
// to one place.
export function DispatchDestinationModal({
    order,
    dispatched,
    stocked,
    onClose,
    onApplied
}: Props) {
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [pending, startTransition] = useTransition();

    const [lines, setLines] = useState<LineState[]>(() =>
        order.items
            .filter((it): it is typeof it & { uuid: string } => Boolean(it.uuid))
            .map((it) => {
                const out = (dispatched.get(it.uuid) || 0) + (stocked.get(it.uuid) || 0);
                const remaining = Math.max(0, it.quantity - out);
                return {
                    id: it.uuid,
                    name: it.productName,
                    size: it.selection.size || '',
                    ordered: it.quantity,
                    alreadyOut: out,
                    remaining,
                    destination: 'delivery' as DispatchDestination,
                    text: remaining > 0 ? String(remaining) : '0'
                };
            })
    );

    const parsed = useMemo(
        () =>
            lines.map((l) => {
                const n = parseInt(l.text, 10);
                const qty = Number.isFinite(n) && n > 0 ? n : 0;
                return { ...l, qty, overshoot: qty > l.remaining };
            }),
        [lines]
    );

    const totalDeliver = parsed
        .filter((l) => l.destination === 'delivery')
        .reduce((s, l) => s + l.qty, 0);
    const totalStock = parsed
        .filter((l) => l.destination === 'stock')
        .reduce((s, l) => s + l.qty, 0);
    const anyOvershoot = parsed.some((l) => l.overshoot);
    const canSubmit = !pending && !anyOvershoot && totalDeliver + totalStock > 0;

    const setText = (id: string, text: string) => {
        if (text && !/^\d+$/.test(text)) return;
        setLines((prev) => prev.map((l) => (l.id === id ? { ...l, text } : l)));
    };
    const setDest = (id: string, destination: DispatchDestination) => {
        setLines((prev) => prev.map((l) => (l.id === id ? { ...l, destination } : l)));
    };
    const setAllDest = (destination: DispatchDestination) => {
        setLines((prev) =>
            prev.map((l) => (l.remaining > 0 ? { ...l, destination } : l))
        );
    };

    const handleSubmit = () => {
        if (!order.uuid || !canSubmit) return;
        setError(null);
        const send = parsed
            .filter((l) => l.qty > 0)
            .map((l) => ({
                orderItemId: l.id,
                quantity: l.qty,
                destination: l.destination
            }));
        if (send.length === 0) {
            setError('Ingresá al menos una cantidad.');
            return;
        }
        const orderedTotals = lines.map((l) => ({ orderItemId: l.id, ordered: l.ordered }));
        startTransition(async () => {
            const res = await dispatchOrderAction(
                order.uuid!,
                send,
                orderedTotals,
                notes.trim() || undefined
            );
            if (res.error) {
                setError(res.error);
                return;
            }
            onApplied(send);
        });
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Truck size={20} className="text-emerald-600 dark:text-emerald-400" />
                            Despachar pedido
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            <span className="font-mono font-semibold">{order.id}</span>
                            {order.companyName && <span className="ml-2">· {order.companyName}</span>}
                            <span className="ml-2">
                                — elegí destino por línea: entrega o stock del cliente.
                            </span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wide">
                            Destino de todo lo restante
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setAllDest('delivery')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-semibold"
                            >
                                <Truck size={13} /> Entrega
                            </button>
                            <button
                                type="button"
                                onClick={() => setAllDest('stock')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 font-semibold"
                            >
                                <Boxes size={13} /> Stock
                            </button>
                        </div>
                    </div>

                    {lines.length === 0 ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 italic py-6 text-center">
                            Este pedido no tiene líneas registradas.
                        </p>
                    ) : (
                        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    <tr>
                                        <th className="text-left px-3 py-2 font-semibold">Producto</th>
                                        <th className="text-right px-3 py-2 font-semibold w-20">Restante</th>
                                        <th className="text-right px-3 py-2 font-semibold w-24">Cantidad</th>
                                        <th className="text-center px-3 py-2 font-semibold w-44">Destino</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {parsed.map((l) => {
                                        const done = l.remaining === 0;
                                        return (
                                            <tr key={l.id} className={done ? 'opacity-50' : ''}>
                                                <td className="px-3 py-2">
                                                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                                                        {l.name}
                                                    </div>
                                                    {l.size && (
                                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                                            {l.size}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono font-bold text-amber-700 dark:text-amber-300">
                                                    {l.remaining}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={l.text}
                                                        disabled={done}
                                                        onChange={(e) => setText(l.id, e.target.value)}
                                                        className={`w-20 px-2 py-1.5 border rounded text-right font-mono text-sm outline-none focus:ring-2 disabled:bg-zinc-100 disabled:dark:bg-zinc-800 disabled:text-zinc-400 ${
                                                            l.overshoot
                                                                ? 'border-red-400 focus:ring-red-400 text-red-700 dark:text-red-300'
                                                                : 'border-zinc-300 dark:border-zinc-700 focus:ring-emerald-500'
                                                        }`}
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="inline-flex w-full rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5">
                                                        <button
                                                            type="button"
                                                            disabled={done}
                                                            onClick={() => setDest(l.id, 'delivery')}
                                                            className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-bold transition-colors ${
                                                                l.destination === 'delivery'
                                                                    ? 'bg-emerald-600 text-white'
                                                                    : 'text-zinc-500 dark:text-zinc-400'
                                                            }`}
                                                        >
                                                            <Truck size={12} /> Entrega
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={done}
                                                            onClick={() => setDest(l.id, 'stock')}
                                                            className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-bold transition-colors ${
                                                                l.destination === 'stock'
                                                                    ? 'bg-indigo-600 text-white'
                                                                    : 'text-zinc-500 dark:text-zinc-400'
                                                            }`}
                                                        >
                                                            <Boxes size={12} /> Stock
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {anyOvershoot && (
                        <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/50">
                            Hay líneas con una cantidad mayor a la restante. Ajustá los valores en rojo.
                        </div>
                    )}

                    <div className="flex flex-wrap gap-3 text-sm">
                        <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                            <Truck size={15} /> Entrega: {totalDeliver}
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300">
                            <Boxes size={15} /> Stock: {totalStock}
                        </span>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Nota (opcional)
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="ej. guía 12345, retira mensajero, etc."
                            className="w-full p-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-transparent"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/50">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:bg-zinc-300 disabled:dark:bg-zinc-700 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {pending ? <Loader2 className="animate-spin" size={18} /> : <Truck size={18} />}
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
