'use client';

import { useEffect, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
    orderId: string;
    insumoName: string;
    totalQty: number;
    preparedQty: number;
    onLocalChange: (orderId: string, insumoName: string, qty: number) => void;
    onCommit: (orderId: string, insumoName: string, qty: number) => Promise<void>;
}

// Compact inline editor for "how much of this insumo have we prepared
// so far". Lives under the insumo row, shown only when the operator
// expands that row. Computes the missing qty live as they type.
//
// We hold the typed string locally so partial input like "12," (CR
// admin uses both comma and period as decimal separators) renders
// while typing — only flushed back to the parent on debounce or blur.
export function InsumoPrepEditor({
    orderId,
    insumoName,
    totalQty,
    preparedQty,
    onLocalChange,
    onCommit
}: Props) {
    const [text, setText] = useState(() => preparedQty > 0 ? String(preparedQty) : '');
    const [pending, startTransition] = useTransition();

    // Re-sync if the row's preparedQty changes from outside this editor
    // (e.g. server refresh, optimistic update from another field).
    useEffect(() => {
        const parsed = parseFloat(text.replace(',', '.'));
        if (Number.isFinite(parsed) && parsed === preparedQty) return;
        setText(preparedQty > 0 ? String(preparedQty) : '');
    }, [preparedQty, text]);

    const parsed = parseFloat(text.replace(',', '.'));
    const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    const missing = Math.max(0, totalQty - safe);
    const isOver = safe > totalQty;
    const isComplete = safe >= totalQty && totalQty > 0;

    const commit = (qty: number) => {
        onLocalChange(orderId, insumoName, qty);
        startTransition(async () => {
            try {
                await onCommit(orderId, insumoName, qty);
            } catch {
                alert('No se pudo guardar la preparación.');
            }
        });
    };

    return (
        <div className="mt-1.5 mx-1 rounded-lg border border-purple-200 dark:border-purple-900/40 bg-white dark:bg-zinc-900 px-3 py-2.5">
            <div className="grid grid-cols-3 gap-2 items-end">
                <Stat label="Total" value={totalQty} tone="neutral" />
                <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-0.5">
                        Preparado
                    </label>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={text}
                        onChange={(e) => {
                            const raw = e.target.value;
                            if (!/^\d*[.,]?\d*$/.test(raw)) return;
                            setText(raw);
                            const n = raw === '' ? 0 : parseFloat(raw.replace(',', '.'));
                            if (Number.isFinite(n) && n >= 0) {
                                onLocalChange(orderId, insumoName, n);
                            }
                        }}
                        onBlur={() => {
                            const normalized = text.replace(',', '.');
                            const n = parseFloat(normalized);
                            const qty = Number.isFinite(n) && n >= 0 ? n : 0;
                            if (qty === preparedQty) return;
                            commit(qty);
                        }}
                        placeholder="0"
                        className="w-full px-2 py-1.5 rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm font-bold text-center text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </div>
                <Stat
                    label={isOver ? 'Sobra' : 'Faltan'}
                    value={isOver ? safe - totalQty : missing}
                    tone={
                        isComplete
                            ? 'good'
                            : isOver
                                ? 'warn'
                                : safe > 0
                                    ? 'progress'
                                    : 'bad'
                    }
                />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px]">
                <span className="text-gray-500 dark:text-zinc-500">
                    {pending ? (
                        <span className="inline-flex items-center gap-1">
                            <Loader2 size={10} className="animate-spin" /> Guardando…
                        </span>
                    ) : isComplete ? (
                        <span className="text-green-700 dark:text-green-400 font-bold">
                            ✓ Insumo preparado por completo
                        </span>
                    ) : safe > 0 ? (
                        <span>
                            {Math.round((safe / totalQty) * 100)}% preparado
                        </span>
                    ) : (
                        <span>Apenas se inicie la preparación, registralo acá.</span>
                    )}
                </span>
                {safe > 0 && (
                    <button
                        type="button"
                        onClick={() => {
                            setText('');
                            commit(0);
                        }}
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 font-semibold"
                    >
                        Limpiar
                    </button>
                )}
            </div>
        </div>
    );
}

function Stat({
    label,
    value,
    tone
}: {
    label: string;
    value: number;
    tone: 'neutral' | 'good' | 'bad' | 'progress' | 'warn';
}) {
    const toneClasses = {
        neutral: 'bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100',
        good: 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300',
        bad: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300',
        progress: 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300',
        warn: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
    }[tone];
    return (
        <div>
            <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-0.5">
                {label}
            </span>
            <span
                className={`block px-2 py-1.5 rounded-md text-sm font-bold text-center ${toneClasses}`}
            >
                {Number.isInteger(value) ? value : value.toFixed(2)}
            </span>
        </div>
    );
}
