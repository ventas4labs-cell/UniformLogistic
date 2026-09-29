'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, PackageMinus, ClipboardCheck, X } from 'lucide-react';
import type { StockRow } from '@/lib/services/stock';
import { useDialog } from '@/lib/use-dialog';
import {
    correctStockAction,
    type StockCorrectionMode
} from '@/app/(admin)/admin/stock/actions';

const fmtInt = (n: number) => new Intl.NumberFormat('es-CR').format(n);

const MODES: {
    id: StockCorrectionMode;
    label: string;
    hint: string;
    Icon: React.ComponentType<{ size?: number }>;
}[] = [
    {
        id: 'exit',
        label: 'Registrar salida',
        hint: 'Resta las piezas que ya salieron de bodega.',
        Icon: PackageMinus
    },
    {
        id: 'adjustment',
        label: 'Fijar conteo real',
        hint: 'Escribe lo que hay físicamente; las tallas en blanco no cambian.',
        Icon: ClipboardCheck
    }
];

/**
 * Admin correction for one product of one company: book pieces that left
 * the bodega without going through a retiro, or overwrite sizes with the
 * physical count. Reserved pieces (pending retiros) are the floor in both
 * modes — the balance writer refuses to go under them.
 */
export function StockCorrectionModal({
    companyId,
    companyName,
    productId,
    productName,
    rows,
    onClose
}: {
    companyId: string;
    companyName: string;
    productId: string;
    productName: string;
    rows: StockRow[];
    onClose: () => void;
}) {
    const router = useRouter();
    // Data-entry dialog: no Escape-to-close, a stray key would drop the counts.
    const dialogRef = useDialog();
    const [mode, setMode] = useState<StockCorrectionMode>('exit');
    const [values, setValues] = useState<Record<string, string>>({});
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    // Per size: the parsed input, whether it's valid, and the resulting on-hand.
    const plan = useMemo(
        () =>
            rows.map((r) => {
                const raw = (values[r.size] ?? '').trim();
                const qty = raw === '' ? null : Number(raw);
                let invalid: string | null = null;
                let after = r.quantityOnHand;
                if (qty !== null) {
                    if (!Number.isInteger(qty) || qty < 0) invalid = 'Número entero';
                    else if (mode === 'exit') {
                        if (qty > r.quantityAvailable)
                            invalid = `Máx. ${fmtInt(r.quantityAvailable)}`;
                        after = r.quantityOnHand - qty;
                    } else {
                        if (qty < r.quantityReserved)
                            invalid = `Mín. ${fmtInt(r.quantityReserved)} (reservadas)`;
                        after = qty;
                    }
                }
                const changes = qty !== null && !invalid && after !== r.quantityOnHand;
                return { row: r, qty, invalid, after, changes };
            }),
        [rows, values, mode]
    );

    const hasInvalid = plan.some((p) => p.invalid);
    const changed = plan.filter((p) => p.changes);
    const delta = changed.reduce((s, p) => s + (p.after - p.row.quantityOnHand), 0);
    const hasReserved = rows.some((r) => r.quantityReserved > 0);

    const switchMode = (m: StockCorrectionMode) => {
        if (m === mode) return;
        setMode(m);
        setValues({});
        setError(null);
    };

    // Salida: take every free piece. Conteo: bring every size down to its floor.
    const fillAll = () =>
        setValues(
            Object.fromEntries(
                rows.map((r) => [
                    r.size,
                    String(mode === 'exit' ? r.quantityAvailable : r.quantityReserved)
                ])
            )
        );

    const submit = () => {
        if (changed.length === 0 || hasInvalid) return;
        startTransition(async () => {
            setError(null);
            const res = await correctStockAction({
                companyId,
                productId,
                mode,
                lines: changed.map((p) => ({ size: p.row.size, quantity: p.qty as number })),
                reason
            });
            if (res.error) {
                setError(res.error);
                return;
            }
            router.refresh();
            if (res.failed.length === 0) {
                onClose();
                return;
            }
            // Partial: the applied sizes already moved, so clear them and
            // keep only the failures on screen.
            const failedSizes = new Set(res.failed.map((f) => f.size));
            setValues((prev) =>
                Object.fromEntries(Object.entries(prev).filter(([s]) => failedSizes.has(s)))
            );
            setError(
                `${res.applied > 0 ? `Se aplicaron ${res.applied} talla(s). ` : ''}No se pudo: ` +
                    res.failed.map((f) => `${f.size} (${f.error})`).join(' · ')
            );
        });
    };

    const activeMode = MODES.find((m) => m.id === mode)!;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={`Corregir stock de ${productName}`}
                tabIndex={-1}
                className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl my-8 outline-none"
            >
                <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                            Corregir stock
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                            {productName} · {companyName}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={pending}
                        aria-label="Cerrar"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    <div
                        role="radiogroup"
                        aria-label="Tipo de corrección"
                        className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-100 dark:bg-zinc-800"
                    >
                        {MODES.map(({ id, label, Icon }) => (
                            <button
                                key={id}
                                type="button"
                                role="radio"
                                aria-checked={mode === id}
                                onClick={() => switchMode(id)}
                                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                                    mode === id
                                        ? 'bg-white dark:bg-zinc-900 text-orange-700 dark:text-orange-300 shadow-sm'
                                        : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200'
                                }`}
                            >
                                <Icon size={15} />
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center justify-between gap-3 -mt-1">
                        <p className="text-xs text-gray-500 dark:text-zinc-400">
                            {activeMode.hint}
                        </p>
                        <button
                            type="button"
                            onClick={fillAll}
                            className="shrink-0 text-xs font-bold text-orange-700 dark:text-orange-300 hover:underline"
                        >
                            {mode === 'exit'
                                ? 'Sacar todo lo libre'
                                : hasReserved
                                  ? 'Todo al mínimo'
                                  : 'Todo en 0'}
                        </button>
                    </div>

                    <table className="w-full text-sm">
                        <thead className="text-xs font-semibold text-gray-500 dark:text-zinc-400">
                            <tr className="border-b border-gray-100 dark:border-zinc-800">
                                <th className="py-2 text-left font-semibold">Talla</th>
                                <th className="py-2 text-right font-semibold">En bodega</th>
                                <th className="py-2 pl-4 text-left font-semibold w-32">
                                    {mode === 'exit' ? 'Salen' : 'Conteo real'}
                                </th>
                                <th className="py-2 text-right font-semibold">Queda</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {plan.map(({ row, invalid, after, changes }) => (
                                <tr key={row.id}>
                                    <td className="py-2 font-mono font-semibold text-gray-800 dark:text-zinc-200">
                                        {row.size}
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                                        {fmtInt(row.quantityOnHand)}
                                        {row.quantityReserved > 0 && (
                                            <div className="text-[10px] text-orange-600 dark:text-orange-400">
                                                {fmtInt(row.quantityReserved)} reserv.
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-2 pl-4">
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            min={mode === 'exit' ? 1 : row.quantityReserved}
                                            max={mode === 'exit' ? row.quantityAvailable : undefined}
                                            step={1}
                                            value={values[row.size] ?? ''}
                                            placeholder={
                                                mode === 'exit' ? '0' : String(row.quantityOnHand)
                                            }
                                            onChange={(e) =>
                                                setValues((prev) => ({
                                                    ...prev,
                                                    [row.size]: e.target.value
                                                }))
                                            }
                                            aria-label={`${mode === 'exit' ? 'Piezas que salen' : 'Conteo real'} talla ${row.size}`}
                                            aria-invalid={!!invalid}
                                            className={`w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 tabular-nums focus:outline-none focus:ring-2 ${
                                                invalid
                                                    ? 'border-red-300 dark:border-red-800 focus:ring-red-500/40'
                                                    : 'border-gray-200 dark:border-zinc-700 focus:ring-orange-500/40'
                                            }`}
                                        />
                                        {invalid && (
                                            <div className="text-[10px] font-semibold text-red-600 dark:text-red-400 mt-0.5">
                                                {invalid}
                                            </div>
                                        )}
                                    </td>
                                    <td
                                        className={`py-2 text-right tabular-nums font-bold ${
                                            changes
                                                ? 'text-orange-700 dark:text-orange-300'
                                                : 'text-gray-400 dark:text-zinc-500'
                                        }`}
                                    >
                                        {fmtInt(after)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <label className="block">
                        <span className="text-xs font-semibold text-gray-600 dark:text-zinc-400">
                            Motivo
                        </span>
                        <input
                            type="text"
                            value={reason}
                            maxLength={200}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={
                                mode === 'exit'
                                    ? 'Ej. entregado al cliente sin retiro registrado'
                                    : 'Ej. conteo físico de bodega'
                            }
                            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                        />
                    </label>

                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-lg text-sm border bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 dark:border-zinc-800">
                    <p className="text-sm text-gray-600 dark:text-zinc-400 tabular-nums">
                        {changed.length === 0 ? (
                            'Sin cambios'
                        ) : (
                            <>
                                <span className="font-bold text-gray-900 dark:text-zinc-100">
                                    {delta > 0 ? '+' : ''}
                                    {fmtInt(delta)}
                                </span>{' '}
                                pzas en {changed.length} talla{changed.length === 1 ? '' : 's'}
                            </>
                        )}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={pending}
                            className="px-3 py-2 text-sm font-bold text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={submit}
                            disabled={pending || changed.length === 0 || hasInvalid}
                            className="px-4 py-2 text-sm font-bold bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                            {pending && <Loader2 size={14} className="animate-spin" />}
                            {mode === 'exit' ? 'Registrar salida' : 'Guardar conteo'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
