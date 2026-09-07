'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    Check,
    Loader2,
    Minus,
    PackageMinus,
    Plus,
    Truck,
    X
} from 'lucide-react';
import type { StockRow } from '@/lib/services/stock';
import {
    WITHDRAWAL_STATUS_LABELS,
    type Withdrawal,
    type WithdrawalStatus
} from '@/lib/services/stock-withdrawals';
import {
    cancelWithdrawalAction,
    requestWithdrawalAction
} from '@/app/(app)/stock/actions';
import { useDialog } from '@/lib/use-dialog';

const STATUS_STYLE: Record<WithdrawalStatus, string> = {
    pending: 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300',
    approved: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300',
    rejected: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300',
    cancelled: 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
};

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CR', {
        timeZone: 'America/Costa_Rica',
        day: '2-digit',
        month: 'short'
    });

export function WithdrawalPanel({
    rows,
    withdrawals
}: {
    rows: StockRow[];
    withdrawals: Withdrawal[];
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const available = rows.filter((r) => r.quantityAvailable > 0);

    const handleCancel = (w: Withdrawal) => {
        if (!confirm(`¿Cancelar ${w.ref}? Las piezas vuelven a quedar disponibles.`)) return;
        startTransition(async () => {
            setError(null);
            const res = await cancelWithdrawalAction(w.id);
            if (res.error) setError(res.error);
            else router.refresh();
        });
    };

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                        Retiros
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">
                        Pedí piezas de tu inventario. Quedan apartadas hasta que
                        Uniform Logistic apruebe el retiro.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setError(null);
                        setDone(null);
                        setOpen(true);
                    }}
                    disabled={available.length === 0}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={
                        available.length === 0
                            ? 'No tenés piezas disponibles para retirar'
                            : 'Solicitar un retiro'
                    }
                >
                    <PackageMinus size={16} /> Solicitar retiro
                </button>
            </div>

            {done && (
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm font-semibold border bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/50">
                    <Check size={18} /> {done}
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm font-semibold border bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50">
                    <AlertTriangle size={18} /> {error}
                </div>
            )}

            {withdrawals.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-zinc-500">
                    Todavía no solicitaste ningún retiro.
                </p>
            ) : (
                <ul className="space-y-2">
                    {withdrawals.map((w) => (
                        <li
                            key={w.id}
                            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-3"
                        >
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                                        {w.ref}
                                    </span>
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_STYLE[w.status]}`}
                                    >
                                        {WITHDRAWAL_STATUS_LABELS[w.status]}
                                    </span>
                                    {w.wantsDelivery && (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 dark:text-zinc-400">
                                            <Truck size={12} /> con entrega
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500 dark:text-zinc-400">
                                        {w.totalPieces} pzas · {fmtDate(w.requestedAt)}
                                    </span>
                                    {w.status === 'pending' && (
                                        <button
                                            type="button"
                                            onClick={() => handleCancel(w)}
                                            disabled={pending}
                                            className="text-xs font-bold text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </div>
                            <ul className="mt-2 space-y-0.5">
                                {w.lines.map((l) => (
                                    <li
                                        key={l.id}
                                        className="text-xs text-gray-600 dark:text-zinc-400 flex justify-between gap-3"
                                    >
                                        <span className="truncate">
                                            {l.productName}{' '}
                                            <span className="text-gray-400 dark:text-zinc-500">
                                                {l.size}
                                            </span>
                                        </span>
                                        <span className="font-mono shrink-0">×{l.quantity}</span>
                                    </li>
                                ))}
                            </ul>
                            {w.reviewNote && (
                                <p className="mt-2 text-xs italic text-gray-500 dark:text-zinc-400">
                                    “{w.reviewNote}”
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {open && (
                <RequestModal
                    rows={available}
                    onClose={() => setOpen(false)}
                    onDone={(msg) => {
                        setOpen(false);
                        setDone(msg);
                        router.refresh();
                    }}
                />
            )}
        </section>
    );
}

function RequestModal({
    rows,
    onClose,
    onDone
}: {
    rows: StockRow[];
    onClose: () => void;
    onDone: (msg: string) => void;
}) {
    const dialogRef = useDialog();
    const [qty, setQty] = useState<Record<string, number>>({});
    const [recipient, setRecipient] = useState('');
    const [notes, setNotes] = useState('');
    const [wantsDelivery, setWantsDelivery] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const keyOf = (r: StockRow) => `${r.productId}|${r.size}`;
    const total = useMemo(
        () => Object.values(qty).reduce((s, n) => s + (n || 0), 0),
        [qty]
    );

    const bump = (r: StockRow, delta: number) => {
        const k = keyOf(r);
        const next = Math.max(0, Math.min(r.quantityAvailable, (qty[k] || 0) + delta));
        setQty({ ...qty, [k]: next });
    };

    const submit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        setError(null);
        const lines = rows
            .map((r) => ({
                productId: r.productId,
                size: r.size,
                quantity: qty[keyOf(r)] || 0
            }))
            .filter((l) => l.quantity > 0);
        if (lines.length === 0) {
            setError('Elegí al menos una pieza.');
            return;
        }
        setSaving(true);
        const res = await requestWithdrawalAction(lines, recipient, notes, wantsDelivery);
        setSaving(false);
        if (res.error) {
            setError(res.error);
            return;
        }
        onDone(
            `${res.ref} enviado — ${res.pieces} pzas apartadas. Te avisamos cuando se apruebe.`
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Solicitar retiro"
                tabIndex={-1}
                className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl outline-none flex flex-col max-h-[85vh]"
            >
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        Solicitar retiro
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={submit} className="flex flex-col min-h-0 flex-1">
                    <div className="overflow-y-auto p-5 space-y-3">
                        {rows.map((r) => {
                            const k = keyOf(r);
                            const n = qty[k] || 0;
                            return (
                                <div
                                    key={k}
                                    className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">
                                            {r.productName}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400">
                                            {r.size} · {r.quantityAvailable} disponibles
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => bump(r, -1)}
                                            disabled={n === 0}
                                            className="p-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-zinc-700"
                                            aria-label={`Quitar una unidad de ${r.productName} ${r.size}`}
                                        >
                                            <Minus size={14} />
                                        </button>
                                        <span className="w-8 text-center font-mono font-bold text-sm tabular-nums">
                                            {n}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => bump(r, 1)}
                                            disabled={n >= r.quantityAvailable}
                                            className="p-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-zinc-700"
                                            aria-label={`Agregar una unidad de ${r.productName} ${r.size}`}
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-5 border-t border-gray-100 dark:border-zinc-800 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="block">
                                <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1">
                                    Quién retira
                                </span>
                                <input
                                    type="text"
                                    value={recipient}
                                    onChange={(e) => setRecipient(e.target.value)}
                                    placeholder="Nombre de quien recibe"
                                    className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-transparent"
                                />
                            </label>
                            <label className="block">
                                <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1">
                                    Nota (opcional)
                                </span>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="ej. para sucursal Heredia"
                                    className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-transparent"
                                />
                            </label>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
                            <input
                                type="checkbox"
                                checked={wantsDelivery}
                                onChange={(e) => setWantsDelivery(e.target.checked)}
                                className="rounded accent-orange-600"
                            />
                            <Truck size={14} className="text-gray-500 dark:text-zinc-400" />
                            Necesito que lo entreguen (si no, se retira en bodega)
                        </label>

                        {error && (
                            <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">
                                {error}
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-gray-500 dark:text-zinc-400">
                                Total:{' '}
                                <span className="font-bold text-gray-900 dark:text-zinc-100 tabular-nums">
                                    {total}
                                </span>{' '}
                                pzas
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || total === 0}
                                    className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <Loader2 size={14} className="animate-spin" />}
                                    Enviar solicitud
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
