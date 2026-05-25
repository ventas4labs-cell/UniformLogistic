'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, X, Truck } from 'lucide-react';
import type { Order } from '@/lib/types';
import { createDispatchAction } from '@/app/(admin)/admin/empaque/actions';

interface Props {
    order: Order;
    /**
     * Already-dispatched quantities for this order, keyed by
     * order_items.id. Pulled from the parent board so the modal can
     * compute remaining quantities without an extra fetch.
     */
    dispatched: Map<string, number>;
    onClose: () => void;
    /**
     * Fired after the server action succeeds. Receives the lines that
     * were actually shipped (qty > 0) so the parent can bump its
     * optimistic totals.
     */
    onApplied: (lines: { orderItemId: string; quantity: number }[]) => void;
}

interface LineState {
    /** order_items.id — present for any DB-backed line item. */
    id: string;
    name: string;
    size: string;
    ordered: number;
    alreadyShipped: number;
    remaining: number;
    /** Free-text so partial entry like "" / "0" / "5" stays editable. */
    text: string;
}

export function DispatchModal({ order, dispatched, onClose, onApplied }: Props) {
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [pending, startTransition] = useTransition();

    // Snapshot ordered + shipped at modal open so the inputs stay
    // stable while the user types. Defaults each line's "ship now"
    // value to its remaining qty — most dispatches ship everything
    // available, and overriding to a smaller number is easy.
    const [lines, setLines] = useState<LineState[]>(() =>
        order.items
            // Skip any line that somehow doesn't have a DB id — we
            // can't reference it in order_dispatch_items.
            .filter((it): it is typeof it & { uuid: string } => Boolean(it.uuid))
            .map((it) => {
                const shipped = dispatched.get(it.uuid) || 0;
                const remaining = Math.max(0, it.quantity - shipped);
                return {
                    id: it.uuid,
                    name: it.productName,
                    size: it.selection.size || '',
                    ordered: it.quantity,
                    alreadyShipped: shipped,
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

    const totalToShip = parsedLines.reduce((s, l) => s + l.qty, 0);
    const anyOvershoot = parsedLines.some((l) => l.overshoot);
    const canSubmit = !pending && !anyOvershoot && totalToShip > 0;

    const setLineText = (id: string, text: string) => {
        // Allow only digits, including empty (so the field can clear).
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
            setError('Ingresá al menos una cantidad a despachar.');
            return;
        }
        const orderedTotals = lines.map((l) => ({
            orderItemId: l.id,
            ordered: l.ordered
        }));
        startTransition(async () => {
            try {
                await createDispatchAction(
                    order.uuid!,
                    linesToSend,
                    notes.trim() || undefined,
                    orderedTotals
                );
                onApplied(linesToSend);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Error al despachar');
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Truck size={20} className="text-emerald-600 dark:text-emerald-400" />
                            Despachar pedido
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                            <span className="font-mono font-semibold">{order.id}</span>
                            {order.companyName && (
                                <span className="ml-2">· {order.companyName}</span>
                            )}
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
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-zinc-400 font-semibold uppercase tracking-wide">
                            Cantidades a despachar
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setAll('remaining')}
                                className="px-2 py-1 rounded text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-semibold"
                            >
                                Despachar todo lo restante
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
                                        <th className="text-right px-3 py-2 font-semibold w-24">Despachado</th>
                                        <th className="text-right px-3 py-2 font-semibold w-24">Restante</th>
                                        <th className="text-right px-3 py-2 font-semibold w-28">Despachar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {parsedLines.map((l) => {
                                        const fullyDone = l.remaining === 0;
                                        return (
                                            <tr
                                                key={l.id}
                                                className={
                                                    fullyDone
                                                        ? 'bg-green-50/50 dark:bg-green-950/20'
                                                        : ''
                                                }
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
                                                    {l.alreadyShipped}
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
                                                                : 'border-gray-300 dark:border-zinc-700 focus:ring-emerald-500'
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
                                            Total a despachar
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300">
                                            {totalToShip}
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
                            placeholder="ej. guía 12345, retira mensajero, etc."
                            className="w-full p-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
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
                            className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:bg-gray-300 disabled:dark:bg-zinc-700 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {pending ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <Truck size={18} />
                            )}
                            Confirmar despacho{totalToShip > 0 ? ` (${totalToShip})` : ''}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
