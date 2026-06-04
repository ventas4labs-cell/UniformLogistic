'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    RefreshCw,
    Loader2,
    ChevronDown,
    ChevronUp,
    Package,
    CheckCircle2,
    AlertTriangle,
    X,
    Send,
    ImageIcon,
    Check,
    FileDown,
} from 'lucide-react';
import type { Order } from '@/lib/types';
import type { InsumoCompletion } from '@/lib/services/insumo-completions';
import {
    aggregateInsumos,
    aggregateInsumosGlobal,
} from '@/lib/stage-utils';
import {
    reportMissingInsumoAction,
    setInsumoPreparationAction,
    toggleInsumoCompleteAction,
} from '@/app/(admin)/admin/operador/actions';
import { StageCompleteToggle } from '@/components/admin/stage-complete-toggle';
import type { StageTab } from '@/components/admin/stage-tab-bar';
import { StageBoardFilters } from '@/components/admin/stage-board-filters';
import { CollapsibleSearch } from '@/components/admin/collapsible-search';
import { InsumoPrepEditor } from '@/components/admin/insumo-prep-editor';
import type { InsumoPreparation } from '@/lib/services/insumo-preparations';

const completionKey = (orderId: string, insumoName: string) =>
    `${orderId}|${insumoName}`;

function ReportMissingForm({
    orderId,
    insumoName,
    requiredQty,
    onClose,
    onSent,
}: {
    orderId: string;
    insumoName: string;
    requiredQty: number;
    onClose: () => void;
    onSent: () => void;
}) {
    const [missingQty, setMissingQty] = useState<string>(String(requiredQty));
    const [notes, setNotes] = useState('');
    const [sending, startSending] = useTransition();

    const handleSubmit = () => {
        const qty = parseFloat(missingQty);
        if (!qty || qty <= 0) return;
        startSending(async () => {
            try {
                await reportMissingInsumoAction(
                    orderId,
                    insumoName,
                    requiredQty,
                    qty,
                    notes || undefined
                );
                onSent();
            } catch {
                alert('Error al reportar faltante');
            }
        });
    };

    return (
        <div className="mt-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-red-700 dark:text-red-300">
                    Reportar faltante: {insumoName}
                </p>
                <button onClick={onClose} className="text-red-400 hover:text-red-600">
                    <X size={14} />
                </button>
            </div>
            <div className="flex gap-2">
                <div className="flex-1">
                    <label className="text-xs text-red-600 dark:text-red-400">Cant. faltante</label>
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
                    <label className="text-xs text-red-600 dark:text-red-400">Nota (opcional)</label>
                    <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Detalle..."
                        className="w-full px-2 py-1.5 border border-red-200 dark:border-red-800 rounded text-sm bg-white dark:bg-zinc-900 outline-none focus:ring-1 focus:ring-red-400"
                    />
                </div>
            </div>
            <button
                onClick={handleSubmit}
                disabled={sending || !parseFloat(missingQty)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
                {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Enviar reporte
            </button>
        </div>
    );
}

function ImagePreviewModal({
    src,
    alt,
    onClose,
}: {
    src: string;
    alt: string;
    onClose: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={onClose}
        >
            <div
                className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden max-w-lg w-full"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
                >
                    <X size={18} />
                </button>
                <img
                    src={src}
                    alt={alt}
                    className="w-full h-auto max-h-[70vh] object-contain"
                />
                <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800">
                    <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">
                        {alt}
                    </p>
                </div>
            </div>
        </div>
    );
}

function OrderCard({
    order,
    isCompleted,
    onLocalCompletionChange,
    completedInsumos,
    onToggleInsumo,
    preparations,
    onLocalPrepChange,
    onCommitPrep,
    stationNames,
}: {
    order: Order;
    isCompleted: boolean;
    onLocalCompletionChange: (uuid: string, next: boolean) => void;
    completedInsumos: Set<string>;
    onToggleInsumo: (orderId: string, insumoName: string, completed: boolean) => void;
    preparations: Map<string, number>;
    onLocalPrepChange: (orderId: string, insumoName: string, qty: number) => void;
    onCommitPrep: (orderId: string, insumoName: string, qty: number) => Promise<void>;
    stationNames: string[];
}) {
    const [expanded, setExpanded] = useState(false);
    const [reportingInsumo, setReportingInsumo] = useState<string | null>(null);
    const [sentReports, setSentReports] = useState<Set<string>>(new Set());
    const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    // Blob URL of the generated PDF held while the preview modal is
    // open; revoked on close so we don't leak object URLs.
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    // Which insumo rows have their prep-editor disclosure open. Keyed
    // by insumo name (unique within this card's insumo list).
    const [prepOpen, setPrepOpen] = useState<Set<string>>(new Set());
    const insumos = aggregateInsumos(order.items);
    const totalPieces = order.items.reduce((s, i) => s + i.quantity, 0);

    const handleGeneratePdf = async () => {
        setPdfLoading(true);
        try {
            const { generateAdminPDF } = await import('@/lib/pdf-service');
            const pdf = generateAdminPDF(order, { stationNames });
            const url = URL.createObjectURL(pdf.output('blob'));
            setPdfPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return url;
            });
        } finally {
            setPdfLoading(false);
        }
    };

    const closePdfPreview = () => {
        setPdfPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
    };

    const downloadPdfPreview = () => {
        if (!pdfPreviewUrl) return;
        const a = document.createElement('a');
        a.href = pdfPreviewUrl;
        a.download = `${order.id}.pdf`;
        a.click();
    };

    return (
        <div
            className={`bg-white dark:bg-zinc-900 rounded-xl shadow-sm border overflow-hidden ${
                isCompleted
                    ? 'border-green-200 dark:border-green-900/40'
                    : 'border-gray-200 dark:border-zinc-800'
            }`}
        >
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                            {order.id}
                        </p>
                        <p className="font-semibold text-gray-900 dark:text-zinc-100 truncate">
                            {order.companyName || '—'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                            {new Date(order.dateCreated).toLocaleDateString()}
                            {order.deliveryDate && (
                                <span className="ml-2">
                                    Entrega: {new Date(order.deliveryDate).toLocaleDateString()}
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <StageCompleteToggle
                            orderUuid={order.uuid}
                            orderRef={order.id}
                            stage="bodega"
                            isCompleted={isCompleted}
                            onLocalChange={onLocalCompletionChange}
                        />
                        <button
                            type="button"
                            onClick={handleGeneratePdf}
                            disabled={pdfLoading}
                            title="Generar PDF de bodega"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-gray-600 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 hover:bg-orange-100 dark:hover:bg-orange-950/40 hover:text-orange-700 dark:hover:text-orange-300 transition-colors disabled:opacity-50"
                        >
                            {pdfLoading ? (
                                <Loader2 size={12} className="animate-spin" />
                            ) : (
                                <FileDown size={12} />
                            )}
                            PDF
                        </button>
                    </div>
                </div>
                {stationNames.length > 0 && (
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-2">
                        <span className="font-bold">Estación:</span>{' '}
                        {stationNames.join(', ')}
                    </p>
                )}

                <div className="flex items-center gap-3 mt-3">
                    <span className="bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-xs font-bold px-2 py-1 rounded-full">
                        {totalPieces} pzas
                    </span>
                    <span className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 text-xs font-bold px-2 py-1 rounded-full">
                        {order.items.length} líneas
                    </span>
                    {insumos.length > 0 && (
                        <span className="bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 text-xs font-bold px-2 py-1 rounded-full">
                            {insumos.length} insumos
                        </span>
                    )}
                </div>

                {order.notes && (
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 italic line-clamp-2">
                        {order.notes}
                    </p>
                )}
            </div>

            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-1 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 transition-colors"
            >
                {expanded ? (
                    <>
                        Ocultar detalle <ChevronUp size={14} />
                    </>
                ) : (
                    <>
                        Ver detalle <ChevronDown size={14} />
                    </>
                )}
            </button>

            {expanded && (
                <div className="border-t border-gray-100 dark:border-zinc-800">
                    <div className="p-4 space-y-3">
                        <h4 className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
                            Artículos
                        </h4>
                        <div className="space-y-1.5">
                            {order.items.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-3 text-sm bg-gray-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2"
                                >
                                    {item.imageUrl ? (
                                        <button
                                            onClick={() =>
                                                setPreviewImage({
                                                    src: item.imageUrl!,
                                                    alt: item.productName,
                                                })
                                            }
                                            className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-zinc-700 hover:ring-2 hover:ring-orange-400 transition-all cursor-pointer"
                                        >
                                            <img
                                                src={item.imageUrl}
                                                alt={item.productName}
                                                className="w-full h-full object-cover"
                                            />
                                        </button>
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-zinc-700 shrink-0 flex items-center justify-center">
                                            <ImageIcon size={16} className="text-gray-400 dark:text-zinc-500" />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <span className="font-medium text-gray-900 dark:text-zinc-100">
                                            {item.productName}
                                        </span>
                                        <span className="text-gray-500 dark:text-zinc-400 ml-2 text-xs">
                                            {item.selection.size || ''}
                                        </span>
                                        {item.fabricType && (
                                            <span className="text-gray-400 dark:text-zinc-500 ml-1 text-xs">
                                                · {item.fabricType}
                                            </span>
                                        )}
                                    </div>
                                    <span className="font-bold text-gray-700 dark:text-zinc-200 shrink-0 ml-2">
                                        x{item.quantity}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {insumos.length === 0 && (
                            <div className="pt-2">
                                <h4 className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-wide mb-1.5">
                                    Insumos necesarios
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-zinc-500 italic px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                                    {order.items.some((i) => i.bom && i.bom.length > 0)
                                        ? 'Las cantidades configuradas para los insumos son cero.'
                                        : 'Sin insumos configurados en los productos de este pedido. Editá el producto en Admin → Productos para agregar BOM.'}
                                </p>
                            </div>
                        )}

                        {insumos.length > 0 && (
                            <>
                                <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide pt-2">
                                    Insumos necesarios
                                </h4>
                                <div className="space-y-1.5">
                                    {insumos.map((ins) => {
                                        const isCompleted =
                                            !!order.uuid &&
                                            completedInsumos.has(completionKey(order.uuid, ins.name));
                                        const prepKey = `${order.uuid}|${ins.name}`;
                                        const preparedQty = preparations.get(prepKey) || 0;
                                        const isPrepOpen = prepOpen.has(ins.name);
                                        const hasProgress = preparedQty > 0;
                                        const isFullyPrepared =
                                            preparedQty >= ins.totalQty && ins.totalQty > 0;
                                        return (
                                            <div key={ins.name}>
                                                <div
                                                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                                                        isCompleted
                                                            ? 'bg-green-50 dark:bg-green-950/30'
                                                            : 'bg-purple-50 dark:bg-purple-950/30'
                                                    }`}
                                                >
                                                    <span
                                                        className={`truncate ${
                                                            isCompleted
                                                                ? 'text-green-800 dark:text-green-300 line-through'
                                                                : 'text-purple-900 dark:text-purple-200'
                                                        }`}
                                                    >
                                                        {ins.name}
                                                    </span>
                                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                                        {/* Qty pill — shows progress as "prep/total"
                                                            when the operator has logged any prep. */}
                                                        <span
                                                            className={`font-bold tabular-nums ${
                                                                isCompleted
                                                                    ? 'text-green-700 dark:text-green-300'
                                                                    : isFullyPrepared
                                                                        ? 'text-green-700 dark:text-green-300'
                                                                        : hasProgress
                                                                            ? 'text-orange-600 dark:text-orange-400'
                                                                            : 'text-purple-700 dark:text-purple-300'
                                                            }`}
                                                        >
                                                            {hasProgress
                                                                ? `${Number.isInteger(preparedQty) ? preparedQty : preparedQty.toFixed(2)}/${ins.totalQty}`
                                                                : ins.totalQty}
                                                        </span>
                                                        {order.uuid && (
                                                            <button
                                                                onClick={() =>
                                                                    setPrepOpen((prev) => {
                                                                        const n = new Set(prev);
                                                                        if (n.has(ins.name)) n.delete(ins.name);
                                                                        else n.add(ins.name);
                                                                        return n;
                                                                    })
                                                                }
                                                                className="p-1 text-gray-400 dark:text-zinc-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                                                                title={isPrepOpen ? 'Cerrar preparación' : 'Registrar preparación'}
                                                                aria-label="Preparación"
                                                            >
                                                                {isPrepOpen ? (
                                                                    <ChevronUp size={14} />
                                                                ) : (
                                                                    <ChevronDown size={14} />
                                                                )}
                                                            </button>
                                                        )}
                                                        {order.uuid && (
                                                            <button
                                                                onClick={() =>
                                                                    onToggleInsumo(order.uuid!, ins.name, !isCompleted)
                                                                }
                                                                className={`rounded-full p-1 transition-colors ${
                                                                    isCompleted
                                                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                                                        : 'bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:border-green-500 hover:text-green-600'
                                                                }`}
                                                                title={isCompleted ? 'Marcar como pendiente' : 'Marcar como completo'}
                                                            >
                                                                <Check size={12} strokeWidth={3} />
                                                            </button>
                                                        )}
                                                        {sentReports.has(ins.name) ? (
                                                            <span className="text-red-500 dark:text-red-400" title="Faltante reportado">
                                                                <CheckCircle2 size={14} />
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() =>
                                                                    setReportingInsumo(
                                                                        reportingInsumo === ins.name ? null : ins.name
                                                                    )
                                                                }
                                                                className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300 transition-colors"
                                                                title="Reportar faltante"
                                                            >
                                                                <AlertTriangle size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {isPrepOpen && order.uuid && (
                                                    <InsumoPrepEditor
                                                        orderId={order.uuid}
                                                        insumoName={ins.name}
                                                        totalQty={ins.totalQty}
                                                        preparedQty={preparedQty}
                                                        onLocalChange={onLocalPrepChange}
                                                        onCommit={onCommitPrep}
                                                    />
                                                )}
                                                {reportingInsumo === ins.name && order.uuid && (
                                                    <ReportMissingForm
                                                        orderId={order.uuid}
                                                        insumoName={ins.name}
                                                        requiredQty={ins.totalQty}
                                                        onClose={() => setReportingInsumo(null)}
                                                        onSent={() => {
                                                            setReportingInsumo(null);
                                                            setSentReports((prev) =>
                                                                new Set(prev).add(ins.name)
                                                            );
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {previewImage && (
                <ImagePreviewModal
                    src={previewImage.src}
                    alt={previewImage.alt}
                    onClose={() => setPreviewImage(null)}
                />
            )}

            {pdfPreviewUrl && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
                    onClick={closePdfPreview}
                >
                    <div
                        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 dark:border-zinc-800">
                            <div className="min-w-0">
                                <p className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                                    {order.id}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                                    {order.companyName || '—'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={downloadPdfPreview}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/40"
                                    title="Descargar PDF"
                                >
                                    <FileDown size={14} /> Descargar
                                </button>
                                <button
                                    type="button"
                                    onClick={closePdfPreview}
                                    className="p-1.5 rounded-lg text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                    aria-label="Cerrar"
                                    title="Cerrar"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <iframe
                            src={pdfPreviewUrl}
                            title={`Vista previa ${order.id}`}
                            className="flex-1 w-full bg-gray-100 dark:bg-zinc-950"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export function OperatorBoard({
    initialOrders,
    initialCompletions,
    initialBodegaCompletedOrderIds = [],
    initialPreparations = [],
    stationNamesByOrder = {}
}: {
    initialOrders: Order[];
    initialCompletions: InsumoCompletion[];
    initialBodegaCompletedOrderIds?: string[];
    initialPreparations?: InsumoPreparation[];
    // orderId → assigned external station name(s). Rendered on the
    // card + included in the Bodega PDF export.
    stationNamesByOrder?: Record<string, string[]>;
}) {
    const [orders] = useState<Order[]>(initialOrders);
    const [preparations, setPreparations] = useState<Map<string, number>>(
        () => new Map(initialPreparations.map((p) => [`${p.orderId}|${p.insumoName}`, p.preparedQty]))
    );
    const handleLocalPrepChange = (
        orderId: string,
        insumoName: string,
        qty: number
    ) => {
        const key = `${orderId}|${insumoName}`;
        setPreparations((prev) => {
            const next = new Map(prev);
            if (qty <= 0) next.delete(key);
            else next.set(key, qty);
            return next;
        });
    };
    const handleCommitPrep = async (
        orderId: string,
        insumoName: string,
        qty: number
    ) => {
        await setInsumoPreparationAction(orderId, insumoName, qty);
    };
    const [completedInsumos, setCompletedInsumos] = useState<Set<string>>(
        () => new Set(initialCompletions.map((c) => completionKey(c.orderId, c.insumoName)))
    );
    const [bodegaCompleted, setBodegaCompleted] = useState<Set<string>>(
        () => new Set(initialBodegaCompletedOrderIds)
    );
    const [tab, setTab] = useState<StageTab>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [companyFilter, setCompanyFilter] = useState<string>('all');
    const [showGlobalInsumos, setShowGlobalInsumos] = useState(false);
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    const handleLocalCompletionChange = (uuid: string, next: boolean) => {
        setBodegaCompleted((prev) => {
            const n = new Set(prev);
            if (next) n.add(uuid);
            else n.delete(uuid);
            return n;
        });
    };

    const handleToggleInsumo = (
        orderId: string,
        insumoName: string,
        completed: boolean
    ) => {
        const key = completionKey(orderId, insumoName);
        setCompletedInsumos((prev) => {
            const next = new Set(prev);
            if (completed) next.add(key);
            else next.delete(key);
            return next;
        });
        startTransition(async () => {
            try {
                await toggleInsumoCompleteAction(orderId, insumoName, completed);
            } catch {
                alert('Error al actualizar insumo');
                setCompletedInsumos((prev) => {
                    const rollback = new Set(prev);
                    if (completed) rollback.delete(key);
                    else rollback.add(key);
                    return rollback;
                });
            }
        });
    };

    const tabFiltered = orders.filter((o) => {
        if (tab === 'all') return true;
        const done = !!o.uuid && bodegaCompleted.has(o.uuid);
        return tab === 'done' ? done : !done;
    });
    const filtered = tabFiltered.filter((o) => {
        if (companyFilter !== 'all' && o.companyName !== companyFilter) return false;
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            o.customerName?.toLowerCase().includes(term) ||
            o.companyName?.toLowerCase().includes(term) ||
            o.id?.toLowerCase().includes(term)
        );
    });

    const tabCounts = {
        pending: orders.filter((o) => !(o.uuid && bodegaCompleted.has(o.uuid))).length,
        done: orders.filter((o) => o.uuid && bodegaCompleted.has(o.uuid)).length,
        all: orders.length
    };

    // Pre-completion orders for the global insumo summary — exclude
    // completed/cancelled since they don't need insumos prepared.
    const activeOrders = filtered.filter(
        (o) => o.status !== 'completed' && o.status !== 'cancelled'
    );
    const globalInsumos = aggregateInsumosGlobal(activeOrders);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                        Operador — Insumos
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Seguimiento de pedidos y preparación de insumos.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <CollapsibleSearch
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Buscar por orden, empresa o cliente…"
                    />
                    <StageBoardFilters
                        orders={orders}
                        counts={tabCounts}
                        tab={tab}
                        setTab={setTab}
                        companyFilter={companyFilter}
                        setCompanyFilter={setCompanyFilter}
                    />
                    <button
                        onClick={() => router.refresh()}
                        className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                        title="Recargar"
                        aria-label="Recargar"
                    >
                        <RefreshCw size={18} className={pending ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Global insumo summary toggle */}
            {globalInsumos.length > 0 && (
                <div className="mb-4">
                    <button
                        onClick={() => setShowGlobalInsumos(!showGlobalInsumos)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors shadow-sm"
                    >
                        <Package size={16} />
                        Resumen de insumos ({globalInsumos.length})
                        {showGlobalInsumos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {showGlobalInsumos && (
                        <div className="mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-purple-200 dark:border-purple-900/50 p-4">
                            <h3 className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide mb-3">
                                Insumos totales (pedidos activos)
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {globalInsumos.map((ins) => (
                                    <div
                                        key={ins.name}
                                        className="flex items-center justify-between bg-purple-50 dark:bg-purple-950/30 rounded-lg px-3 py-2.5"
                                    >
                                        <span className="text-sm text-purple-900 dark:text-purple-200 truncate">
                                            {ins.name}
                                        </span>
                                        <span className="font-bold text-purple-700 dark:text-purple-300 text-sm shrink-0 ml-2">
                                            {ins.totalQty}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Order cards grid */}
            {filtered.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400">
                    No se encontraron pedidos.
                </div>
            ) : (
                // items-start so an expanded card doesn't stretch its row
                // siblings — each card sizes to its own content.
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                    {filtered.map((order) => (
                        <OrderCard
                            key={order.uuid || order.id}
                            order={order}
                            isCompleted={!!order.uuid && bodegaCompleted.has(order.uuid)}
                            onLocalCompletionChange={handleLocalCompletionChange}
                            completedInsumos={completedInsumos}
                            onToggleInsumo={handleToggleInsumo}
                            preparations={preparations}
                            onLocalPrepChange={handleLocalPrepChange}
                            onCommitPrep={handleCommitPrep}
                            stationNames={
                                (order.uuid && stationNamesByOrder[order.uuid]) || []
                            }
                        />
                    ))}
                </div>
            )}

            {pending && (
                <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
                    <Loader2 className="animate-spin" size={14} />
                    Actualizando...
                </div>
            )}
        </div>
    );
}
