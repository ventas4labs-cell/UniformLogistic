'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    Check,
    ChevronDown,
    Loader2,
    PackageMinus,
    Truck,
    X
} from 'lucide-react';
import {
    WITHDRAWAL_STATUS_LABELS,
    type Withdrawal,
    type WithdrawalStatus
} from '@/lib/services/stock-withdrawals';
import { reviewWithdrawalAction } from '@/app/(admin)/admin/stock/actions';

const STATUS_STYLE: Record<WithdrawalStatus, string> = {
    pending: 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300',
    approved: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300',
    rejected: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300',
    cancelled: 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
};

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('es-CR', {
        timeZone: 'America/Costa_Rica',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });

export function WithdrawalsQueue({ withdrawals }: { withdrawals: Withdrawal[] }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);

    const queue = withdrawals.filter((w) => w.status === 'pending');
    const history = withdrawals.filter((w) => w.status !== 'pending');

    const review = (w: Withdrawal, approve: boolean) => {
        if (!approve) {
            const note = prompt(`¿Por qué se rechaza ${w.ref}? (opcional)`);
            if (note === null) return; // cancelled the prompt
            startTransition(async () => {
                setError(null);
                const res = await reviewWithdrawalAction(w.id, false, note);
                if (res.error) setError(res.error);
                else router.refresh();
            });
            return;
        }
        if (
            !confirm(
                `¿Aprobar ${w.ref}? Se descuentan ${w.totalPieces} pzas del stock de ${w.companyName}.`
            )
        )
            return;
        startTransition(async () => {
            setError(null);
            const res = await reviewWithdrawalAction(w.id, true);
            if (res.error) setError(res.error);
            else router.refresh();
        });
    };

    if (withdrawals.length === 0) return null;

    return (
        <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
                <PackageMinus size={18} className="text-orange-600 dark:text-orange-400" />
                <h3 className="font-bold text-gray-900 dark:text-zinc-100">
                    Retiros solicitados
                </h3>
                {queue.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-orange-600 text-white text-[11px] font-bold">
                        {queue.length} pendiente{queue.length === 1 ? '' : 's'}
                    </span>
                )}
            </div>

            {error && (
                <div className="mb-3 flex items-center gap-2 p-3 rounded-lg text-sm border bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {queue.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                    No hay retiros pendientes de aprobación.
                </p>
            ) : (
                <ul className="space-y-2">
                    {queue.map((w) => (
                        <li
                            key={w.id}
                            className="bg-white dark:bg-zinc-900 border border-orange-200 dark:border-orange-900/40 rounded-xl p-3"
                        >
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                                            {w.ref}
                                        </span>
                                        <span className="font-semibold text-gray-900 dark:text-zinc-100">
                                            {w.companyName}
                                        </span>
                                        {w.wantsDelivery && (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 dark:text-zinc-400">
                                                <Truck size={12} /> con entrega
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                                        {w.totalPieces} pzas · {fmtDate(w.requestedAt)}
                                        {w.recipientName && ` · retira: ${w.recipientName}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => review(w, false)}
                                        disabled={pending}
                                        className="px-3 py-1.5 text-sm font-bold text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        <X size={14} /> Rechazar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => review(w, true)}
                                        disabled={pending}
                                        className="px-3 py-1.5 text-sm font-bold bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {pending ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Check size={14} />
                                        )}
                                        Aprobar
                                    </button>
                                </div>
                            </div>
                            <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                                {w.lines.map((l) => (
                                    <li
                                        key={l.id}
                                        className="text-xs text-gray-600 dark:text-zinc-400 flex justify-between gap-3 py-0.5"
                                    >
                                        <span className="truncate">
                                            {l.productName}{' '}
                                            <span className="text-gray-400 dark:text-zinc-500">
                                                {l.size}
                                            </span>
                                        </span>
                                        <span className="font-mono shrink-0 tabular-nums">
                                            ×{l.quantity}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {w.notes && (
                                <p className="mt-2 text-xs italic text-gray-500 dark:text-zinc-400">
                                    “{w.notes}”
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {history.length > 0 && (
                <div className="mt-3">
                    <button
                        type="button"
                        onClick={() => setShowHistory((v) => !v)}
                        className="text-xs font-bold text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 flex items-center gap-1"
                        aria-expanded={showHistory}
                    >
                        <ChevronDown
                            size={14}
                            className={`transition-transform ${showHistory ? 'rotate-180' : ''}`}
                        />
                        Historial de retiros ({history.length})
                    </button>
                    {showHistory && (
                        <ul className="mt-2 space-y-1">
                            {history.map((w) => (
                                <li
                                    key={w.id}
                                    className="flex items-center justify-between gap-3 text-xs bg-gray-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2"
                                >
                                    <span className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono font-bold text-gray-600 dark:text-zinc-300">
                                            {w.ref}
                                        </span>
                                        <span className="truncate text-gray-700 dark:text-zinc-300">
                                            {w.companyName}
                                        </span>
                                        <span
                                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[w.status]}`}
                                        >
                                            {WITHDRAWAL_STATUS_LABELS[w.status]}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-gray-500 dark:text-zinc-400 tabular-nums">
                                        {w.totalPieces} pzas ·{' '}
                                        {fmtDate(w.reviewedAt || w.requestedAt)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </section>
    );
}
