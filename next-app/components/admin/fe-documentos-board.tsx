'use client';

import { useMemo, useState, useTransition } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock,
    Loader2,
    RefreshCcw,
    Send,
    Sparkles,
    Receipt,
    Wallet
} from 'lucide-react';
import { CollapsibleSearch } from '@/components/admin/collapsible-search';
import type {
    FeDocumentoRow,
    FeDocumentosSummary,
    FeEstadoHacienda
} from '@/lib/services/feDocumentos';
import {
    consultarDocumentoAction,
    reintentarEnvioAction
} from '@/app/(admin)/admin/facturacion/documentos-actions';
import { emitirNotaAction } from '@/app/(admin)/admin/facturacion/nota-actions';

const fmtCRC = (n: number) =>
    new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: 'CRC',
        maximumFractionDigits: 0
    }).format(n);

const fmtInt = (n: number) => new Intl.NumberFormat('es-CR').format(n);

const ESTADO_META: Record<FeEstadoHacienda, { label: string; cls: string }> = {
    pendiente: {
        label: 'Pendiente',
        cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
    },
    procesando: {
        label: 'Procesando',
        cls: 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300'
    },
    aceptado: {
        label: 'Aceptado',
        cls: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
    },
    aceptado_parcial: {
        label: 'Aceptado parcial',
        cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
    },
    rechazado: {
        label: 'Rechazado',
        cls: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
    },
    error: {
        label: 'Error',
        cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
    }
};

const TIPO_META: Record<string, string> = {
    '01': 'Factura',
    '02': 'Nota Débito',
    '03': 'Nota Crédito',
    '04': 'Tiquete',
    '08': 'Fact. Compra',
    '10': 'Mensaje Receptor'
};

interface Props {
    documentos: FeDocumentoRow[];
    summary: FeDocumentosSummary;
}

export function FeDocumentosBoard({ documentos, summary }: Props) {
    const [query, setQuery] = useState('');
    const [estadoFilter, setEstadoFilter] = useState<FeEstadoHacienda | 'todos'>('todos');
    const [tipoFilter, setTipoFilter] = useState<string>('todos');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [pending, startTransition] = useTransition();

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return documentos.filter((d) => {
            if (estadoFilter !== 'todos' && d.estado_hacienda !== estadoFilter) return false;
            if (tipoFilter !== 'todos' && d.tipo_documento !== tipoFilter) return false;
            if (!q) return true;
            return (
                d.clave.toLowerCase().includes(q) ||
                d.consecutivo.toLowerCase().includes(q) ||
                (d.receptor_nombre || '').toLowerCase().includes(q) ||
                (d.order_number ? `orden-${String(d.order_number).padStart(5, '0')}`.includes(q) : false)
            );
        });
    }, [documentos, query, estadoFilter, tipoFilter]);

    const toggle = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const showToast = (t: { type: 'success' | 'error'; text: string }) => {
        setToast(t);
        setTimeout(() => setToast(null), 4000);
    };

    const onConsultar = (id: string) =>
        startTransition(async () => {
            const r = await consultarDocumentoAction(id);
            showToast(
                r.success
                    ? { type: 'success', text: `Hacienda: ${r.estado_hacienda || 'sin cambios'}` }
                    : { type: 'error', text: r.error || 'Error al consultar' }
            );
        });

    const onReenviar = (id: string) =>
        startTransition(async () => {
            const r = await reintentarEnvioAction(id);
            showToast(
                r.success
                    ? { type: 'success', text: `Reintento ok: ${r.estado_hacienda}` }
                    : { type: 'error', text: r.error || 'Error al reintentar' }
            );
        });

    const onAnular = (id: string) => {
        const razon = window.prompt(
            'Razón de la nota de crédito (anulación):',
            'Anulación a solicitud del cliente'
        );
        if (!razon) return;
        startTransition(async () => {
            const r = await emitirNotaAction({
                original_documento_id: id,
                tipo: '03',
                codigo_referencia: '01', // 01 = Anula documento de referencia
                razon
            });
            showToast(
                r.success
                    ? { type: 'success', text: `NC ${r.consecutivo} emitida (${r.estado_hacienda})` }
                    : { type: 'error', text: r.error || 'Error al emitir NC' }
            );
        });
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                        Documentos electrónicos
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Estado en vivo de las facturas enviadas a Hacienda.
                    </p>
                </div>
            </div>

            {/* KPI strip */}
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                <Kpi
                    label="Aceptadas"
                    value={fmtInt(summary.aceptados)}
                    Icon={CheckCircle2}
                    accent="emerald"
                />
                <Kpi
                    label="Procesando"
                    value={fmtInt(summary.procesando)}
                    Icon={Loader2}
                    accent="zinc"
                />
                <Kpi
                    label="Rechazadas"
                    value={fmtInt(summary.rechazados)}
                    Icon={AlertTriangle}
                    accent={summary.rechazados > 0 ? 'red' : 'zinc'}
                />
                <Kpi
                    label="Con error"
                    value={fmtInt(summary.error)}
                    Icon={AlertTriangle}
                    accent={summary.error > 0 ? 'amber' : 'zinc'}
                />
                <Kpi
                    label="Total facturado"
                    value={fmtCRC(summary.totalFacturado)}
                    Icon={Wallet}
                    accent="orange"
                />
            </section>

            {/* Filters */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-3 mb-4 flex flex-col sm:flex-row gap-2 sm:items-center border border-gray-200 dark:border-zinc-800">
                <CollapsibleSearch
                    value={query}
                    onChange={setQuery}
                    placeholder="Buscar clave, consecutivo, receptor o ORDEN-XXXXX…"
                    expandedClassName="w-full sm:flex-1"
                />
                <select
                    value={estadoFilter}
                    onChange={(e) =>
                        setEstadoFilter(e.target.value as FeEstadoHacienda | 'todos')
                    }
                    className="p-2 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm font-semibold"
                >
                    <option value="todos">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="procesando">Procesando</option>
                    <option value="aceptado">Aceptado</option>
                    <option value="aceptado_parcial">Aceptado parcial</option>
                    <option value="rechazado">Rechazado</option>
                    <option value="error">Error</option>
                </select>
                <select
                    value={tipoFilter}
                    onChange={(e) => setTipoFilter(e.target.value)}
                    className="p-2 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm font-semibold"
                >
                    <option value="todos">Todos los tipos</option>
                    <option value="01">Factura (01)</option>
                    <option value="02">Nota Débito (02)</option>
                    <option value="03">Nota Crédito (03)</option>
                    <option value="04">Tiquete (04)</option>
                    <option value="08">Factura Compra (08)</option>
                    <option value="10">Mensaje Receptor (10)</option>
                </select>
            </div>

            {toast && (
                <div
                    className={`mb-3 p-3 rounded-lg text-sm border ${
                        toast.type === 'success'
                            ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/60 text-green-800 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300'
                    }`}
                >
                    {toast.text}
                </div>
            )}

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-zinc-900/60 text-xs font-semibold text-gray-600 dark:text-zinc-400">
                        <tr>
                            <th className="p-3 w-8"></th>
                            <th className="p-3">Consecutivo</th>
                            <th className="p-3">Tipo</th>
                            <th className="p-3">Receptor</th>
                            <th className="p-3">Pedido</th>
                            <th className="p-3 text-right">Total</th>
                            <th className="p-3">Estado</th>
                            <th className="p-3">Fecha</th>
                            <th className="p-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {visible.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={9}
                                    className="p-8 text-center text-gray-400 dark:text-zinc-500"
                                >
                                    <Receipt size={28} className="mx-auto mb-2 opacity-30" />
                                    Sin documentos para los filtros seleccionados.
                                </td>
                            </tr>
                        ) : (
                            visible.map((d) => {
                                const meta = ESTADO_META[d.estado_hacienda] || ESTADO_META.pendiente;
                                const tipoLabel = TIPO_META[d.tipo_documento] || d.tipo_documento;
                                const isOpen = expanded.has(d.id);
                                const orderRef = d.order_number
                                    ? `ORDEN-${String(d.order_number).padStart(5, '0')}`
                                    : null;
                                const canAnular =
                                    (d.tipo_documento === '01' ||
                                        d.tipo_documento === '04') &&
                                    (d.estado_hacienda === 'aceptado' ||
                                        d.estado_hacienda === 'aceptado_parcial');
                                return (
                                    <FragRow
                                        key={d.id}
                                        d={d}
                                        meta={meta}
                                        tipoLabel={tipoLabel}
                                        orderRef={orderRef}
                                        isOpen={isOpen}
                                        canAnular={canAnular}
                                        pending={pending}
                                        toggle={toggle}
                                        onConsultar={onConsultar}
                                        onReenviar={onReenviar}
                                        onAnular={onAnular}
                                    />
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Subcomponents ───────────────────────────────────────────────────────

interface RowProps {
    d: FeDocumentoRow;
    meta: { label: string; cls: string };
    tipoLabel: string;
    orderRef: string | null;
    isOpen: boolean;
    canAnular: boolean;
    pending: boolean;
    toggle: (id: string) => void;
    onConsultar: (id: string) => void;
    onReenviar: (id: string) => void;
    onAnular: (id: string) => void;
}

function FragRow({
    d,
    meta,
    tipoLabel,
    orderRef,
    isOpen,
    canAnular,
    pending,
    toggle,
    onConsultar,
    onReenviar,
    onAnular
}: RowProps) {
    return (
        <>
            <tr
                className="hover:bg-gray-50 dark:hover:bg-zinc-800/60 cursor-pointer"
                onClick={() => toggle(d.id)}
            >
                <td className="p-3">
                    {isOpen ? (
                        <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                        <ChevronRight size={16} className="text-gray-400" />
                    )}
                </td>
                <td className="p-3 font-mono text-xs text-gray-700 dark:text-zinc-300">
                    {d.consecutivo}
                </td>
                <td className="p-3 text-xs font-semibold">{tipoLabel}</td>
                <td className="p-3">
                    <div className="font-semibold text-gray-900 dark:text-zinc-100">
                        {d.receptor_nombre || '—'}
                    </div>
                    {d.receptor_cedula && (
                        <div className="font-mono text-[10px] text-gray-400 dark:text-zinc-500">
                            {d.receptor_cedula}
                        </div>
                    )}
                </td>
                <td className="p-3 font-mono text-xs text-gray-500 dark:text-zinc-400">
                    {orderRef || '—'}
                </td>
                <td className="p-3 text-right text-gray-900 dark:text-zinc-100 font-bold tabular-nums">
                    {fmtCRC(d.total_comprobante)}
                </td>
                <td className="p-3">
                    <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${meta.cls}`}
                    >
                        {meta.label}
                    </span>
                </td>
                <td className="p-3 text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                    {d.fecha_emision.slice(0, 10)}
                </td>
                <td className="p-3 text-right">
                    <div
                        className="inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {(d.estado_hacienda === 'procesando' ||
                            d.estado_hacienda === 'pendiente') && (
                            <button
                                onClick={() => onConsultar(d.id)}
                                disabled={pending}
                                className="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400 disabled:opacity-50"
                                title="Consultar Hacienda"
                            >
                                {pending ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <RefreshCcw size={14} />
                                )}
                            </button>
                        )}
                        {(d.estado_hacienda === 'error' || d.estado_envio === 'error') && (
                            <button
                                onClick={() => onReenviar(d.id)}
                                disabled={pending}
                                className="p-1.5 rounded hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-300 disabled:opacity-50"
                                title="Reintentar envío"
                            >
                                <Send size={14} />
                            </button>
                        )}
                        {canAnular && (
                            <button
                                onClick={() => onAnular(d.id)}
                                disabled={pending}
                                className="px-2 py-1 rounded bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-700 dark:text-red-300 text-[11px] font-bold disabled:opacity-50"
                                title="Emitir Nota Crédito que anula este documento"
                            >
                                Anular
                            </button>
                        )}
                    </div>
                </td>
            </tr>
            {isOpen && (
                <tr className="bg-zinc-50 dark:bg-zinc-950/60">
                    <td colSpan={9} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                                <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-zinc-500 font-semibold mb-1">
                                    Clave
                                </div>
                                <div className="font-mono break-all">{d.clave}</div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-zinc-500 font-semibold mb-1">
                                    Mensaje de Hacienda
                                </div>
                                <div className="font-mono whitespace-pre-wrap">
                                    {d.mensaje_hacienda || '—'}
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-zinc-500 font-semibold mb-1">
                                    Subtotal · IVA · Total
                                </div>
                                <div className="font-mono">
                                    {fmtCRC(
                                        d.total_comprobante - d.total_impuesto + d.total_descuentos
                                    )}{' '}
                                    · {fmtCRC(d.total_impuesto)} ·{' '}
                                    <strong>{fmtCRC(d.total_comprobante)}</strong>
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-zinc-500 font-semibold mb-1 inline-flex items-center gap-1">
                                    <Clock size={11} />
                                    Intentos
                                </div>
                                <div className="font-mono">
                                    {d.intentos_envio ?? 0}
                                    {d.ultimo_intento_at && (
                                        <span className="text-gray-400 dark:text-zinc-500 ml-2">
                                            (último: {new Date(d.ultimo_intento_at).toLocaleString('es-CR')})
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

function Kpi({
    label,
    value,
    Icon,
    accent
}: {
    label: string;
    value: string;
    Icon: React.ComponentType<{ size?: number }>;
    accent: 'orange' | 'emerald' | 'zinc' | 'red' | 'amber';
}) {
    const ring = {
        orange: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300',
        emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
        zinc: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
        red: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',
        amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
    }[accent];
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ring}`}>
                <Icon size={18} />
            </div>
            <div className="min-w-0">
                <div className="text-xs text-gray-500 dark:text-zinc-400 font-medium truncate">
                    {label}
                </div>
                <div className="text-xl font-extrabold text-gray-900 dark:text-zinc-100 leading-none mt-0.5 truncate">
                    {value}
                </div>
            </div>
        </div>
    );
}

// Re-export the brand "Sparkles" icon import so eslint doesn't strip it
// during unused-import passes — it's used elsewhere in the admin tree.
export const __keepSparkles = Sparkles;
