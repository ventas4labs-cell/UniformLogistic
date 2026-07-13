'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, X, Boxes } from 'lucide-react';
import type { Order } from '@/lib/types';
import { addOrderToStockAction } from '@/app/(admin)/admin/empaque/actions';

interface Props {
    order: Order;
    /**
     * Already-added-to-stock quantities for this order, keyed by
     * order_items.id. Pulled from the parent board so the modal can
     * compute remaining without an extra fetch.
     */
    addedToStock: Map<string, number>;
    onClose: () => void;
    /**
     * Fired after the server action succeeds. Receives the lines that
     * were actually added (qty > 0) so the parent can bump its
     * optimistic totals.
     */
    onApplied: (lines: { orderItemId: string; quantity: number }[]) => void;
}

interface LineState {
    id: string;
    name: string;
    size: string;
    ordered: number;
    alreadyAdded: number;
    remaining: number;
    text: string;
}

export function AddToStockModal({ order, addedToStock, onClose, onApplied }: Props) {
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [pending, startTransition] = useTransition();

    // Snapshot ordered + added at open; default each line to its
    // remaining (adding everything left is the common case).
    const [lines, setLines] = useState<LineState[]>(() =>
        order.items
            .filter((it): it is typeof it & { uuid: string } => Boolean(it.uuid))
            .map((it) => {
                const added = addedToStock.get(it.uuid) || 0;
                const remaining = Math.max(0, it.quantity - added);
                return {
                    id: it.uuid,
                    name: it.productName,
                    size: it.selection.size || '',
                    ordered: it.quantity,
                    alreadyAdded: added,
                    remaining,
                    text: remaining > 0 ? String(remaining) : '0'
                };
            })
    );

    const parsedLines = useMemo(
        () =>
            lines.map((l) => {
                const n = parseInt(l.text, 10);
                const qty = Number.isFinite(n) && n > 0 ? n : 0;
                const overshoot = qty > l.remaining;
                return { ...l, qty, overshoot };
            }),
        [lines]
    );

    const totalToAdd = parsedLines.reduce((s, l) => s + l.qty, 0);
    const anyOvershoot = parsedLines.some((l) => l.overshoot);
    const canSubmit = !pending && !anyOvershoot && totalToAdd > 0;

    const setLineText = (id: string, text: string) => {
        if (text && !/^\d+$/.test(text)) return;
        setLines((prev) => prev.map((l) => (l.id === id ? { ...l, text } : l)));
    };

    const setAll = (mode: 'remaining' | 'zero') => {
        setLines((prev) =>
            prev.map((l) => ({
                ...l,
                text: mode === 'remaining' ? String(l.remaining) : '0'
            }))
        );
    };

    const handleSubmit = () => {
        if (!order.uuid || !canSubmit) return;
        setError(null);
        const linesToSend = parsedLines
            .filter((l) => l.qty > 0)
            .map((l) => ({ orderItemId: l.id, quantity: l.qty }));
        if (linesToSend.length === 0) {
            setError('Ingresá al menos una cantidad a agregar.');
            return;
        }
        startTransition(async () => {
            const res = await addOrderToStockAction(
                order.uuid!,
                linesToSend,
                notes.trim() || undefined
            );
            if (res.error) {
                setError(res.error);
                return;
            }
            onApplied(linesToSend);
        });
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Boxes size={20} className="text-indigo-600 dark:text-indigo-400" />
                            Agregar a stock
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                            <span className="font-mono font-semibold">{order.id}</span>
                            {order.companyName && <span className="ml-2">· {order.companyName}</span>}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600 dark:text-zinc-400">
                        Confirmá las cantidades que se sumarán al inventario de la
                        empresa. Podés agregar solo una parte y completar el resto
                        después.
                    </p>

                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-zinc-400 font-semibold uppercase tracking-wide">
                            Cantidades a agregar
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setAll('remaining')}
                                className="px-2 py-1 rounded text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 font-semibold"
                            >
                                Agregar todo lo restante
                            </button>
                            <button
                                type="button"
                                onClick={() => setAll('zero')}
                                className="px-2 py-1 rounded text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 font-semibold"
                            >
                                Limpiar
                            </button>
                        </div>
                    </div>

                    {lines.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-zinc-400 italic py-6 text-center">
                            Este pedido no tiene líneas registradas.
                        </p>
                    ) : (
                        <div className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-200 dark:border-zinc-800 text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                                    <tr>
                                        <th className="text-left px-3 py-2 font-semibold">Producto</th>
                                        <th className="text-right px-3 py-2 font-semibold w-20">Pedido</th>
                                        <th className="text-right px-3 py-2 font-semibold w-24">En stock</th>
                                        <th className="text-right px-3 py-2 font-semibold w-24">Restante</th>
                                        <th className="text-right px-3 py-2 font-semibold w-28">Agregar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {parsedLines.map((l) => {
                                        const fullyDone = l.remaining === 0;
                                        return (
                                            <tr
                                                key={l.id}
                                                className={fullyDone ? 'bg-green-50/50 dark:bg-green-950/20' : ''}
                                            >
                                                <td className="px-3 py-2">
                                                    <div className="font-medium text-gray-900 dark:text-zinc-100">
                                                        {l.name}
                                                    </div>
                                                    {l.size && (
                                                        <div className="text-xs text-gray-500 dark:text-zinc-400">
                                                            {l.size}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-zinc-300">
                                                    {l.ordered}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-zinc-300">
                                                    {l.alreadyAdded}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono">
                                                    {fullyDone ? (
                                                        <span className="text-green-700 dark:text-green-300 font-bold">
                                                            0
                                                        </span>
                                                    ) : (
                                                        <span className="text-amber-700 dark:text-amber-300 font-bold">
                                                            {l.remaining}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={l.text}
                                                        disabled={fullyDone}
                                                        onChange={(e) => setLineText(l.id, e.target.value)}
                                                        className={`w-20 px-2 py-1.5 border rounded text-right font-mono text-sm outline-none focus:ring-2 disabled:bg-gray-100 disabled:dark:bg-zinc-800 disabled:text-gray-400 disabled:dark:text-zinc-600 ${
                                                            l.overshoot
                                                                ? 'border-red-400 focus:ring-red-400 text-red-700 dark:text-red-300'
                                                                : 'border-gray-300 dark:border-zinc-700 focus:ring-indigo-500'
                                                        }`}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-gray-50 dark:bg-zinc-900/60 border-t border-gray-200 dark:border-zinc-800">
                                    <tr>
                                        <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                                            Total a agregar
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono font-bold text-indigo-700 dark:text-indigo-300">
                                            {totalToAdd}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {anyOvershoot && (
                        <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/50">
                            Hay líneas con una cantidad mayor a la restante. Ajustá los
                            valores en rojo antes de continuar.
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                            Nota (opcional)
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="ej. producción extra, sobrante, etc."
                            className="w-full p-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
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
                            className="flex-1 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:bg-gray-300 disabled:dark:bg-zinc-700 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {pending ? <Loader2 className="animate-spin" size={18} /> : <Boxes size={18} />}
                            Confirmar y agregar{totalToAdd > 0 ? ` (${totalToAdd})` : ''}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
