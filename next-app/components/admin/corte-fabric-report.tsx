'use client';

import { useMemo, useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, Loader2, Ruler, Save, Check } from 'lucide-react';
import { DecimalInput } from '@/components/admin/decimal-input';
import { ColorSwatches } from '@/components/admin/color-swatches';
import { parseColors } from '@/lib/stage-utils';
import {
    fabricLinesForOrder,
    FABRIC_UNITS,
    DEFAULT_FABRIC_UNIT,
    type FabricLine
} from '@/lib/corte-fabric';
import type { Order } from '@/lib/types';
import type { CorteFabricReport } from '@/lib/services/corte-fabric-reports';
import { saveCorteFabricReportAction } from '@/app/(admin)/admin/_stage-actions';

// ─── Corte fabric consumption report ─────────────────────────────────
// One input per tela the order is cut from. Where the product BOM lets
// us predict the consumption we show esperado next to the real figure
// and the difference, so over-spend is visible at a glance. The BOM
// estimate is sent along on save and snapshotted server-side.

interface Draft {
    qty: number;
    unit: string;
    note: string;
}

const fmt = (n: number) =>
    n.toLocaleString('es-CR', { maximumFractionDigits: 2 });

function seedDrafts(
    lines: FabricLine[],
    reports: CorteFabricReport[]
): Record<string, Draft> {
    const byTela = new Map(reports.map((r) => [r.fabricType, r]));
    const out: Record<string, Draft> = {};
    for (const l of lines) {
        const r = byTela.get(l.fabricType);
        out[l.fabricType] = {
            qty: r?.qtyUsed ?? 0,
            unit: r?.unit || l.unit || DEFAULT_FABRIC_UNIT,
            note: r?.notes || ''
        };
    }
    return out;
}

export function CorteFabricReportPanel({
    order,
    initialReports = []
}: {
    order: Order;
    initialReports?: CorteFabricReport[];
}) {
    const lines = useMemo(() => fabricLinesForOrder(order), [order]);
    const [open, setOpen] = useState(false);
    const [saved, setSaved] = useState<Record<string, Draft>>(() =>
        seedDrafts(lines, initialReports)
    );
    const [draft, setDraft] = useState<Record<string, Draft>>(() =>
        seedDrafts(lines, initialReports)
    );
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [justSaved, setJustSaved] = useState(false);

    // Totals for the collapsed header, grouped by unit so we never add
    // metros to kilos.
    const reportedByUnit = useMemo(() => {
        const m = new Map<string, number>();
        for (const l of lines) {
            const d = saved[l.fabricType];
            if (!d || d.qty <= 0) continue;
            m.set(d.unit, (m.get(d.unit) || 0) + d.qty);
        }
        return Array.from(m.entries());
    }, [lines, saved]);

    const hasReport = reportedByUnit.length > 0;
    const dirty = lines.some((l) => {
        const a = draft[l.fabricType];
        const b = saved[l.fabricType];
        return a?.qty !== b?.qty || a?.unit !== b?.unit || a?.note !== b?.note;
    });

    const setLine = (tela: string, patch: Partial<Draft>) => {
        setJustSaved(false);
        setDraft((prev) => ({
            ...prev,
            [tela]: { ...prev[tela], ...patch }
        }));
    };

    const handleSave = () => {
        if (!order.uuid || !dirty || pending) return;
        setError(null);
        const snapshot = { ...draft };
        const entries = lines.map((l) => ({
            fabricType: l.fabricType,
            qtyUsed: draft[l.fabricType]?.qty ?? 0,
            unit: draft[l.fabricType]?.unit || DEFAULT_FABRIC_UNIT,
            expectedQty: l.expectedQty,
            notes: draft[l.fabricType]?.note ?? ''
        }));
        startTransition(async () => {
            const res = await saveCorteFabricReportAction(order.uuid as string, entries);
            if (res.error) {
                setError(res.error);
                return;
            }
            setSaved(snapshot);
            setJustSaved(true);
        });
    };

    if (lines.length === 0) return null;

    return (
        <div className="rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-700 dark:text-zinc-200 bg-gray-50 dark:bg-zinc-800/60 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
                <Ruler size={15} className="text-orange-600 dark:text-orange-400 shrink-0" />
                <span>Consumo de tela</span>
                {hasReport && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300">
                        {reportedByUnit.map(([u, q]) => `${fmt(q)} ${u}`).join(' · ')}
                    </span>
                )}
                {!hasReport && (
                    <span className="text-[11px] font-medium text-gray-400 dark:text-zinc-500">
                        Sin reportar
                    </span>
                )}
                <span className="ml-auto text-gray-400 dark:text-zinc-500">
                    {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </span>
            </button>

            {open && (
                <div className="p-3 space-y-3 bg-white dark:bg-zinc-900">
                    {lines.map((line) => {
                        const d = draft[line.fabricType];
                        const colors = parseColors(line.fabricType);
                        // Only compare like with like — an estimate in
                        // metros says nothing about a figure in kilos.
                        const comparable =
                            line.expectedQty !== null && d?.unit === line.unit;
                        const diff = comparable
                            ? (d?.qty ?? 0) - (line.expectedQty as number)
                            : null;
                        return (
                            <div
                                key={line.fabricType || '__none__'}
                                className="rounded-lg bg-gray-50 dark:bg-zinc-800/50 px-3 py-2.5 space-y-2"
                            >
                                <div className="flex items-baseline gap-2 flex-wrap">
                                    <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100">
                                        {line.label}
                                    </span>
                                    {colors.length > 0 && (
                                        <ColorSwatches colors={colors} compact />
                                    )}
                                    <span className="text-xs text-gray-500 dark:text-zinc-400">
                                        {line.pieces} pzas
                                    </span>
                                    {line.expectedQty !== null && (
                                        <span className="text-xs text-gray-500 dark:text-zinc-400 ml-auto">
                                            Esperado:{' '}
                                            <span className="font-semibold text-gray-700 dark:text-zinc-200">
                                                {fmt(line.expectedQty)} {line.unit}
                                            </span>
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                                        Gastado
                                    </span>
                                    <DecimalInput
                                        value={d?.qty ?? 0}
                                        onChange={(qty) => setLine(line.fabricType, { qty })}
                                        placeholder="0"
                                        ariaLabel={`Tela gastada en ${line.label}`}
                                        className="w-20 text-center font-mono font-bold text-sm rounded-lg border border-gray-200 dark:border-zinc-700 px-2 py-1 outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100"
                                    />
                                    <select
                                        value={d?.unit || DEFAULT_FABRIC_UNIT}
                                        onChange={(e) =>
                                            setLine(line.fabricType, { unit: e.target.value })
                                        }
                                        aria-label={`Unidad de ${line.label}`}
                                        className="text-xs font-semibold rounded-lg border border-gray-200 dark:border-zinc-700 px-2 py-1.5 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500"
                                    >
                                        {FABRIC_UNITS.map((u) => (
                                            <option key={u} value={u}>
                                                {u}
                                            </option>
                                        ))}
                                    </select>
                                    {diff !== null && (d?.qty ?? 0) > 0 && (
                                        <span
                                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                diff > 0.005
                                                    ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                                                    : diff < -0.005
                                                        ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300'
                                                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300'
                                            }`}
                                        >
                                            {diff > 0 ? '+' : ''}
                                            {fmt(diff)} {line.unit}
                                            {line.expectedQty
                                                ? ` (${diff > 0 ? '+' : ''}${Math.round(
                                                      (diff / line.expectedQty) * 100
                                                  )}%)`
                                                : ''}
                                        </span>
                                    )}
                                </div>

                                <input
                                    type="text"
                                    value={d?.note ?? ''}
                                    onChange={(e) =>
                                        setLine(line.fabricType, { note: e.target.value })
                                    }
                                    placeholder="Nota (opcional): rollo, desperdicio, etc."
                                    aria-label={`Nota de ${line.label}`}
                                    className="w-full text-xs rounded-lg border border-gray-200 dark:border-zinc-700 px-2 py-1.5 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                        );
                    })}

                    {error && (
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                            {error}
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!order.uuid || !dirty || pending}
                        className="w-full py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {pending ? (
                            <Loader2 size={15} className="animate-spin" />
                        ) : justSaved && !dirty ? (
                            <Check size={15} strokeWidth={3} />
                        ) : (
                            <Save size={15} />
                        )}
                        {pending
                            ? 'Guardando…'
                            : justSaved && !dirty
                                ? 'Reporte guardado'
                                : 'Guardar reporte de tela'}
                    </button>
                </div>
            )}
        </div>
    );
}
