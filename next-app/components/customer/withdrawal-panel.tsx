'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowLeft,
    Check,
    Loader2,
    Minus,
    Package,
    PackageMinus,
    Plus,
    Search,
    Truck,
    X
} from 'lucide-react';
import { stockKey, type StockRow, type StockedOrder } from '@/lib/services/stock';
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
import { compareSizeLabels, splitSizeLabel } from '@/lib/size-order';

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

// Past this many products the picker gets a search box.
const SEARCH_THRESHOLD = 4;

type Qty = Record<string, number>;

interface ProductGroup {
    productId: string;
    productName: string;
    productCode: string;
    imageUrl: string | null;
    /** Every size shares one gender (or none) — shown once, not per cell. */
    gender: string | null;
    mixedGender: boolean;
    rows: StockRow[];
    available: number;
}

const keyOf = (r: StockRow) => stockKey(r.productId, r.size);

const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function WithdrawalPanel({
    rows,
    withdrawals,
    initialOrder
}: {
    rows: StockRow[];
    withdrawals: Withdrawal[];
    /** Set when arriving from an order card's "Retirar" (?retirar=<uuid>). */
    initialOrder?: StockedOrder | null;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const available = useMemo(() => rows.filter((r) => r.quantityAvailable > 0), [rows]);

    // Arriving from an order card opens the picker with that order's
    // pieces already filled in. An order with nothing left to withdraw
    // just opens the page.
    const [preload, setPreload] = useState<Qty | undefined>(() => {
        if (!initialOrder) return undefined;
        const qty = selectionFromOrder(initialOrder, available);
        return Object.keys(qty).length > 0 ? qty : undefined;
    });
    const [open, setOpen] = useState(!!preload);

    // Drop ?retirar= once used, so a refresh or the back button doesn't
    // pop the picker open again.
    const clearDeepLink = () => {
        if (initialOrder) router.replace('/stock', { scroll: false });
    };

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
                        setPreload(undefined);
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
                    initialQty={preload}
                    onClose={() => {
                        setOpen(false);
                        clearDeepLink();
                    }}
                    onDone={(msg) => {
                        setOpen(false);
                        setDone(msg);
                        if (initialOrder) clearDeepLink();
                        else router.refresh();
                    }}
                />
            )}
        </section>
    );
}

/** The pieces an order put in the bodega, capped at what's available now. */
function selectionFromOrder(order: StockedOrder, rows: StockRow[]): Qty {
    const avail = new Map(rows.map((r) => [keyOf(r), r.quantityAvailable]));
    const qty: Qty = {};
    for (const l of order.lines) {
        const k = stockKey(l.productId, l.size);
        const n = Math.min(avail.get(k) || 0, l.quantity);
        if (n > 0) qty[k] = n;
    }
    return qty;
}

function RequestModal({
    rows,
    initialQty,
    onClose,
    onDone
}: {
    rows: StockRow[];
    initialQty?: Qty;
    onClose: () => void;
    onDone: (msg: string) => void;
}) {
    const dialogRef = useDialog();

    const [qty, setQty] = useState<Qty>(initialQty ?? {});
    const [step, setStep] = useState<'pick' | 'confirm'>('pick');
    const [query, setQuery] = useState('');
    const [recipient, setRecipient] = useState('');
    const [notes, setNotes] = useState('');
    const [wantsDelivery, setWantsDelivery] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const groups = useMemo<ProductGroup[]>(() => {
        const map = new Map<string, ProductGroup>();
        for (const r of rows) {
            const g = map.get(r.productId) || {
                productId: r.productId,
                productName: r.productName,
                productCode: r.productCode,
                imageUrl: r.imageUrl,
                gender: null,
                mixedGender: false,
                rows: [],
                available: 0
            };
            g.rows.push(r);
            g.available += r.quantityAvailable;
            map.set(r.productId, g);
        }
        for (const g of map.values()) {
            g.rows.sort((a, b) => compareSizeLabels(a.size, b.size));
            const genders = new Set(g.rows.map((r) => splitSizeLabel(r.size).gender));
            g.mixedGender = genders.size > 1;
            g.gender = g.mixedGender ? null : (g.rows[0] && splitSizeLabel(g.rows[0].size).gender);
        }
        return Array.from(map.values()).sort((a, b) =>
            a.productName.localeCompare(b.productName, 'es')
        );
    }, [rows]);

    const visibleGroups = useMemo(() => {
        const q = normalize(query.trim());
        if (!q) return groups;
        return groups.filter(
            (g) => normalize(g.productName).includes(q) || normalize(g.productCode).includes(q)
        );
    }, [groups, query]);

    const selectedRows = rows.filter((r) => (qty[keyOf(r)] || 0) > 0);
    const total = selectedRows.reduce((s, r) => s + (qty[keyOf(r)] || 0), 0);

    const setFor = (r: StockRow, n: number) => {
        const clean = Number.isFinite(n) ? Math.round(n) : 0;
        const next = Math.max(0, Math.min(r.quantityAvailable, clean));
        setQty((prev) => ({ ...prev, [keyOf(r)]: next }));
    };

    const setGroup = (g: ProductGroup, fill: boolean) => {
        setQty((prev) => {
            const next = { ...prev };
            for (const r of g.rows) next[keyOf(r)] = fill ? r.quantityAvailable : 0;
            return next;
        });
    };

    const submit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        setError(null);
        // Only the review step may send. The pick step has no submit button
        // (so Enter can't implicitly submit), but never rely on that alone.
        if (step === 'pick') {
            if (total > 0) setStep('confirm');
            return;
        }
        const lines = selectedRows.map((r) => ({
            productId: r.productId,
            size: r.size,
            quantity: qty[keyOf(r)] || 0
        }));
        if (lines.length === 0) {
            setError('Elegí al menos una pieza.');
            setStep('pick');
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Solicitar retiro"
                tabIndex={-1}
                className="bg-white dark:bg-zinc-900 w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl outline-none flex flex-col max-h-[92vh] sm:max-h-[88vh]"
            >
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-100 dark:border-zinc-800">
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                            {step === 'pick' ? 'Solicitar retiro' : 'Confirmar retiro'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-zinc-400">
                            {step === 'pick'
                                ? 'Elegí qué piezas sacar de tu bodega.'
                                : 'Revisá las piezas y decinos quién las recibe.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 -m-1"
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={submit} className="flex flex-col min-h-0 flex-1">
                    {step === 'pick' ? (
                        <div className="overflow-y-auto px-5 py-4 space-y-5">
                            {groups.length > SEARCH_THRESHOLD && (
                                <label className="relative block">
                                    <Search
                                        size={15}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                    />
                                    <input
                                        type="search"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Buscar producto…"
                                        aria-label="Buscar producto"
                                        className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-transparent"
                                    />
                                </label>
                            )}

                            {visibleGroups.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-6">
                                    Ningún producto coincide con “{query}”.
                                </p>
                            ) : (
                                visibleGroups.map((g) => (
                                    <ProductPicker
                                        key={g.productId}
                                        group={g}
                                        qty={qty}
                                        onSet={setFor}
                                        onFill={(fill) => setGroup(g, fill)}
                                    />
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="overflow-y-auto px-5 py-4 space-y-4">
                            <ReviewList groups={groups} qty={qty} />

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
                        </div>
                    )}

                    <div className="px-5 py-4 border-t border-gray-100 dark:border-zinc-800 space-y-3">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">
                                {error}
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-gray-500 dark:text-zinc-400 min-w-0">
                                <span className="font-bold text-gray-900 dark:text-zinc-100 tabular-nums">
                                    {total}
                                </span>{' '}
                                pza{total === 1 ? '' : 's'}
                                {selectedRows.length > 0 && (
                                    <span className="hidden sm:inline">
                                        {' '}
                                        · {selectedRows.length} talla
                                        {selectedRows.length === 1 ? '' : 's'}
                                    </span>
                                )}
                                {step === 'pick' && total > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setQty({})}
                                        className="ml-3 text-xs font-semibold text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                                    >
                                        Limpiar
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                                {step === 'pick' ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                                        >
                                            Cancelar
                                        </button>
                                        {/* Keyed apart from "Enviar solicitud": React would
                                            otherwise reuse this <button> in place and flip it to
                                            type="submit" mid-click, and the browser would submit
                                            the form on the same click that opened the review. */}
                                        <button
                                            key="continue"
                                            type="button"
                                            onClick={() => {
                                                setError(null);
                                                setStep('confirm');
                                            }}
                                            disabled={total === 0}
                                            className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50"
                                        >
                                            Continuar
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setStep('pick')}
                                            disabled={saving}
                                            className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1"
                                        >
                                            <ArrowLeft size={14} /> Atrás
                                        </button>
                                        <button
                                            key="submit"
                                            type="submit"
                                            disabled={saving || total === 0}
                                            className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {saving && <Loader2 size={14} className="animate-spin" />}
                                            Enviar solicitud
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ProductPicker({
    group,
    qty,
    onSet,
    onFill
}: {
    group: ProductGroup;
    qty: Qty;
    onSet: (r: StockRow, n: number) => void;
    onFill: (fill: boolean) => void;
}) {
    const picked = group.rows.reduce((s, r) => s + (qty[keyOf(r)] || 0), 0);
    const full = picked === group.available;

    return (
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-zinc-800/40">
                <Thumb src={group.imageUrl} />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">
                        {group.productName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                        {group.gender && `${group.gender} · `}
                        {picked > 0 ? (
                            <span className="text-orange-700 dark:text-orange-300 font-semibold">
                                {picked} de {group.available}
                            </span>
                        ) : (
                            `${group.available} disponibles`
                        )}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => onFill(!full)}
                    className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                        full
                            ? 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                            : 'border-orange-200 dark:border-orange-900/60 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30'
                    }`}
                >
                    {full ? 'Quitar' : 'Todo'}
                </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5">
                {group.rows.map((r) => (
                    <SizeCell
                        key={r.id}
                        row={r}
                        productName={group.productName}
                        showGender={group.mixedGender}
                        value={qty[keyOf(r)] || 0}
                        onSet={(n) => onSet(r, n)}
                    />
                ))}
            </div>
        </div>
    );
}

function SizeCell({
    row,
    productName,
    showGender,
    value,
    onSet
}: {
    row: StockRow;
    productName: string;
    showGender: boolean;
    value: number;
    onSet: (n: number) => void;
}) {
    const { gender, size } = splitSizeLabel(row.size);
    const max = row.quantityAvailable;
    const active = value > 0;

    return (
        <div
            className={`rounded-lg border p-2 transition-colors ${
                active
                    ? 'border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30'
                    : 'border-gray-200 dark:border-zinc-700'
            }`}
        >
            <div className="flex items-baseline justify-between gap-2 px-0.5">
                <span className="min-w-0 truncate text-sm font-bold text-gray-900 dark:text-zinc-100">
                    {showGender && gender && (
                        <span className="font-medium opacity-60">
                            {gender.charAt(0)} ·{' '}
                        </span>
                    )}
                    {size}
                </span>
                <button
                    type="button"
                    onClick={() => onSet(value === max ? 0 : max)}
                    className={`shrink-0 text-[11px] font-semibold tabular-nums hover:text-orange-600 dark:hover:text-orange-400 ${
                        active
                            ? 'text-orange-700/80 dark:text-orange-300/80'
                            : 'text-gray-500 dark:text-zinc-400'
                    }`}
                    title={value === max ? 'Quitar esta talla' : `Retirar las ${max}`}
                >
                    {max} disp.
                </button>
            </div>
            <div className="mt-1.5 flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onSet(value - 1)}
                    disabled={value === 0}
                    className="p-1.5 rounded-md border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 disabled:opacity-30 hover:bg-white dark:hover:bg-zinc-800"
                    aria-label={`Quitar una unidad de ${productName} ${row.size}`}
                >
                    <Minus size={13} />
                </button>
                <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={max}
                    value={value || ''}
                    placeholder="0"
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => onSet(e.target.value === '' ? 0 : Number(e.target.value))}
                    aria-label={`Cantidad de ${productName} ${row.size}`}
                    className="w-full min-w-0 text-center font-mono font-bold text-sm tabular-nums py-1 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-orange-500 outline-none placeholder:text-gray-300 dark:placeholder:text-zinc-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                    type="button"
                    onClick={() => onSet(value + 1)}
                    disabled={value >= max}
                    className="p-1.5 rounded-md border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 disabled:opacity-30 hover:bg-white dark:hover:bg-zinc-800"
                    aria-label={`Agregar una unidad de ${productName} ${row.size}`}
                >
                    <Plus size={13} />
                </button>
            </div>
        </div>
    );
}

function ReviewList({ groups, qty }: { groups: ProductGroup[]; qty: Qty }) {
    const picked = groups
        .map((g) => ({ g, rows: g.rows.filter((r) => (qty[keyOf(r)] || 0) > 0) }))
        .filter((x) => x.rows.length > 0);

    return (
        <ul className="rounded-xl border border-gray-200 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
            {picked.map(({ g, rows }) => (
                <li key={g.productId} className="flex gap-3 p-3">
                    <Thumb src={g.imageUrl} />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">
                            {g.productName}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {rows.map((r) => (
                                <span
                                    key={r.id}
                                    className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-gray-700 dark:text-zinc-300"
                                >
                                    {r.size}
                                    <span className="font-mono font-bold">×{qty[keyOf(r)]}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900 dark:text-zinc-100">
                        {rows.reduce((s, r) => s + (qty[keyOf(r)] || 0), 0)}
                    </span>
                </li>
            ))}
        </ul>
    );
}

function Thumb({ src }: { src: string | null }) {
    const box = 'w-10 h-10 rounded-lg shrink-0 border border-gray-200 dark:border-zinc-700';
    return src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={`${box} object-cover bg-white`} />
    ) : (
        <span
            className={`${box} bg-gray-50 dark:bg-zinc-800 flex items-center justify-center text-gray-300 dark:text-zinc-600`}
        >
            <Package size={16} />
        </span>
    );
}
