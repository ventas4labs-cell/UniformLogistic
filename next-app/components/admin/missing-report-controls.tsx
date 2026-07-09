'use client';

import { useEffect, useState, useTransition } from 'react';
import {
    AlertTriangle,
    Check,
    CheckCircle2,
    Clock,
    History,
    Loader2,
    PackageCheck,
    RotateCcw,
    Send,
    ShoppingCart,
    X
} from 'lucide-react';
import {
    fetchMissingReportsAction,
    markReportReceivedAction,
    reopenMissingReportAction,
    reportMissingItemAction
} from '@/app/(admin)/admin/_stage-actions';
import type { MissingInsumoReport } from '@/lib/services/missing-insumos';

// ─── Per-order "Reportar faltante" affordance ───────────────────────
// A small red button on any operation-board card. Opens an inline form
// where the operator names the missing article, the missing quantity
// and an optional note, then writes it to missing_insumo_reports via
// reportMissingItemAction. Boards that already report per-insumo
// (Operador / Maquila) keep their own granular form; this covers the
// stages that only see finished order lines.
export function OrderReportButton({
    orderId,
    stage,
    defaultItemName = ''
}: {
    orderId: string;
    /** Board raising the report, recorded so the receive step can be
     * surfaced back here later. */
    stage?: string;
    defaultItemName?: string;
}) {
    const [open, setOpen] = useState(false);
    const [sent, setSent] = useState(false);

    if (sent) {
        return (
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                <CheckCircle2 size={14} />
                Faltante reportado
            </div>
        );
    }

    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                title="Reportar faltante"
            >
                <AlertTriangle size={14} />
                Reportar faltante
            </button>
            {open && (
                <ReportMissingForm
                    orderId={orderId}
                    stage={stage}
                    defaultItemName={defaultItemName}
                    onClose={() => setOpen(false)}
                    onSent={() => {
                        setOpen(false);
                        setSent(true);
                    }}
                />
            )}
        </div>
    );
}

function ReportMissingForm({
    orderId,
    stage,
    defaultItemName,
    onClose,
    onSent
}: {
    orderId: string;
    stage?: string;
    defaultItemName: string;
    onClose: () => void;
    onSent: () => void;
}) {
    const [itemName, setItemName] = useState(defaultItemName);
    const [missingQty, setMissingQty] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [sending, startSending] = useTransition();

    const handleSubmit = () => {
        const qty = parseFloat(missingQty);
        if (!itemName.trim()) {
            setError('Indicá qué artículo falta.');
            return;
        }
        if (!qty || qty <= 0) {
            setError('La cantidad faltante debe ser mayor a cero.');
            return;
        }
        setError(null);
        startSending(async () => {
            const res = await reportMissingItemAction(
                orderId,
                itemName,
                qty,
                notes || undefined,
                stage
            );
            if (res.error) {
                setError(res.error);
                return;
            }
            onSent();
        });
    };

    return (
        <div className="mt-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-red-700 dark:text-red-300">
                    Reportar faltante
                </p>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-red-400 hover:text-red-600"
                    aria-label="Cerrar"
                >
                    <X size={14} />
                </button>
            </div>
            <div>
                <label className="text-xs text-red-600 dark:text-red-400">
                    ¿Qué falta?
                </label>
                <input
                    type="text"
                    autoFocus
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Material o artículo faltante"
                    className="w-full px-2 py-1.5 border border-red-200 dark:border-red-800 rounded text-sm bg-white dark:bg-zinc-900 outline-none focus:ring-1 focus:ring-red-400"
                />
            </div>
            <div className="flex gap-2">
                <div className="flex-1">
                    <label className="text-xs text-red-600 dark:text-red-400">
                        Cant. faltante
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={missingQty}
                        onChange={(e) => setMissingQty(e.target.value)}
                        className="w-full px-2 py-1.5 border border-red-200 dark:border-red-800 rounded text-sm bg-white dark:bg-zinc-900 outline-none focus:ring-1 focus:ring-red-400"
                    />
                </div>
                <div className="flex-1">
                    <label className="text-xs text-red-600 dark:text-red-400">
                        Nota (opcional)
                    </label>
                    <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Detalle..."
                        className="w-full px-2 py-1.5 border border-red-200 dark:border-red-800 rounded text-sm bg-white dark:bg-zinc-900 outline-none focus:ring-1 focus:ring-red-400"
                    />
                </div>
            </div>
            {error && (
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}
            <button
                type="button"
                onClick={handleSubmit}
                disabled={sending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
                {sending ? (
                    <Loader2 size={12} className="animate-spin" />
                ) : (
                    <Send size={12} />
                )}
                Enviar reporte
            </button>
        </div>
    );
}

// ─── Top-right "Reportes de faltantes" affordance ───────────────────
// One button per board header. Opens a modal that lazily fetches the
// missing-item reports this board raised. Once the admin has bought a
// reported insumo (status "purchased"), the board confirms arrival here
// with "Marcar recibido", which closes the report. A badge flags how
// many are waiting to be received on this board.
export function MissingReportsHistoryButton({ stage }: { stage?: string }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                title="Reportes de faltantes"
                aria-label="Reportes de faltantes"
            >
                <History size={18} />
            </button>
            {open && (
                <ReportsHistoryModal stage={stage} onClose={() => setOpen(false)} />
            )}
        </>
    );
}

const STATUS_META: Record<
    MissingInsumoReport['status'],
    { label: string; Icon: typeof Clock; cls: string }
> = {
    open: {
        label: 'Pendiente de compra',
        Icon: Clock,
        cls: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/40'
    },
    purchased: {
        label: 'Comprado · por recibir',
        Icon: ShoppingCart,
        cls: 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/40'
    },
    received: {
        label: 'Recibido',
        Icon: CheckCircle2,
        cls: 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-950/40'
    }
};

function ReportsHistoryModal({
    stage,
    onClose
}: {
    stage?: string;
    onClose: () => void;
}) {
    const [reports, setReports] = useState<MissingInsumoReport[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    // Lazy load once when the modal mounts. Guard against setting state
    // after unmount (operator closes the modal mid-fetch).
    useEffect(() => {
        let active = true;
        fetchMissingReportsAction()
            .then((data) => active && setReports(data))
            .catch(
                (e) =>
                    active &&
                    setError(
                        e instanceof Error ? e.message : 'Error al cargar reportes'
                    )
            );
        return () => {
            active = false;
        };
    }, []);

    // Show only the reports this board raised. Legacy reports without a
    // stage fall through to whichever board opens the modal so they're
    // never orphaned.
    const scoped = (reports || []).filter(
        (r) => !stage || !r.stage || r.stage === stage
    );

    // Optimistically move a report to a new status, run the action, roll
    // back on failure.
    const transition = (
        report: MissingInsumoReport,
        next: MissingInsumoReport['status'],
        run: () => Promise<{ error?: string }>
    ) => {
        const prevStatus = report.status;
        setReports((prev) =>
            (prev || []).map((r) =>
                r.id === report.id ? { ...r, status: next } : r
            )
        );
        startTransition(async () => {
            const res = await run();
            if (res.error) {
                setReports((prev) =>
                    (prev || []).map((r) =>
                        r.id === report.id ? { ...r, status: prevStatus } : r
                    )
                );
            }
        });
    };

    const loading = reports === null && !error;
    const awaiting = scoped.filter((r) => r.status === 'purchased').length;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <AlertTriangle
                            size={18}
                            className="text-red-500 dark:text-red-400"
                        />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                            Reportes de faltantes
                        </h3>
                        {!loading && awaiting > 0 && (
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/50 px-2 py-0.5 rounded-full">
                                {awaiting} por recibir
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto p-4 space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-gray-500 dark:text-zinc-400 text-sm">
                            <Loader2 size={16} className="animate-spin" />
                            Cargando reportes...
                        </div>
                    ) : error ? (
                        <p className="py-12 text-center text-sm text-red-600 dark:text-red-400">
                            {error}
                        </p>
                    ) : scoped.length === 0 ? (
                        <p className="py-12 text-center text-sm text-gray-500 dark:text-zinc-400">
                            No hay reportes de faltantes todavía.
                        </p>
                    ) : (
                        scoped.map((r) => {
                            const meta = STATUS_META[r.status];
                            const closed = r.status === 'received';
                            return (
                                <div
                                    key={r.id}
                                    className={`rounded-lg border p-3 ${
                                        closed
                                            ? 'border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40'
                                            : 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p
                                                className={`text-sm font-bold ${
                                                    closed
                                                        ? 'text-gray-500 dark:text-zinc-400 line-through'
                                                        : 'text-gray-900 dark:text-zinc-100'
                                                }`}
                                            >
                                                {r.insumo_name}
                                                <span className="ml-2 font-mono text-xs font-bold text-red-600 dark:text-red-400">
                                                    −{r.missing_qty}
                                                </span>
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                                                {r.order_ref || 'Orden'}
                                                {r.company_name ? ` · ${r.company_name}` : ''}
                                                {' · '}
                                                {new Date(r.created_at).toLocaleDateString()}
                                            </p>
                                            <span
                                                className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.cls}`}
                                            >
                                                <meta.Icon size={11} />
                                                {meta.label}
                                            </span>
                                            {r.notes && (
                                                <p className="text-xs text-gray-600 dark:text-zinc-300 mt-1 italic">
                                                    {r.notes}
                                                </p>
                                            )}
                                        </div>
                                        <div className="shrink-0">
                                            {r.status === 'purchased' && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        transition(r, 'received', () =>
                                                            markReportReceivedAction(r.id)
                                                        )
                                                    }
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-950/50 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                                                    title="Marcar como recibido"
                                                >
                                                    <PackageCheck size={12} /> Marcar recibido
                                                </button>
                                            )}
                                            {r.status === 'received' && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        transition(r, 'open', () =>
                                                            reopenMissingReportAction(r.id)
                                                        )
                                                    }
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                                                    title="Reabrir"
                                                >
                                                    <RotateCcw size={12} /> Reabrir
                                                </button>
                                            )}
                                            {r.status === 'open' && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-400 dark:text-zinc-500">
                                                    <Check size={12} /> Esperando compra
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
