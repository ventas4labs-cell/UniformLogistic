'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    CheckCircle2,
    RefreshCw,
    Loader2,
    Undo2,
    Filter,
} from 'lucide-react';
import type { MissingInsumoReport } from '@/lib/services/missing-insumos';
import {
    resolveReportAction,
    unresolveReportAction,
} from '@/app/(admin)/admin/notificaciones/actions';

export function NotificationCenter({
    initialReports,
}: {
    initialReports: MissingInsumoReport[];
}) {
    const [reports, setReports] = useState(initialReports);
    const [showResolved, setShowResolved] = useState(false);
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    const unresolvedCount = reports.filter((r) => !r.resolved).length;
    const filtered = showResolved ? reports : reports.filter((r) => !r.resolved);

    const handleResolve = (id: string) => {
        setReports((prev) =>
            prev.map((r) =>
                r.id === id ? { ...r, resolved: true, resolved_at: new Date().toISOString() } : r
            )
        );
        startTransition(async () => {
            try {
                await resolveReportAction(id);
            } catch {
                router.refresh();
            }
        });
    };

    const handleUnresolve = (id: string) => {
        setReports((prev) =>
            prev.map((r) =>
                r.id === id ? { ...r, resolved: false, resolved_at: null } : r
            )
        );
        startTransition(async () => {
            try {
                await unresolveReportAction(id);
            } catch {
                router.refresh();
            }
        });
    };

    const groupedByOrder = filtered.reduce(
        (acc, r) => {
            const key = r.order_id;
            if (!acc[key]) acc[key] = { ref: r.order_ref || r.order_id, company: r.company_name || '', items: [] };
            acc[key].items.push(r);
            return acc;
        },
        {} as Record<string, { ref: string; company: string; items: MissingInsumoReport[] }>
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                        Notificaciones
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Reportes de insumos faltantes del operador.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {unresolvedCount > 0 && (
                        <span className="bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                            <AlertTriangle size={14} />
                            {unresolvedCount} pendiente{unresolvedCount !== 1 ? 's' : ''}
                        </span>
                    )}
                    <button
                        onClick={() => router.refresh()}
                        className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                    >
                        <RefreshCw size={20} className={pending ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setShowResolved(false)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
                        !showResolved
                            ? 'bg-red-600 text-white shadow-md'
                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                    }`}
                >
                    <Filter size={14} />
                    Pendientes ({unresolvedCount})
                </button>
                <button
                    onClick={() => setShowResolved(true)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
                        showResolved
                            ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-md'
                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                    }`}
                >
                    Todos ({reports.length})
                </button>
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400">
                    {showResolved
                        ? 'No hay reportes de faltantes.'
                        : 'No hay faltantes pendientes. Todo en orden.'}
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(groupedByOrder).map(([orderId, group]) => (
                        <div
                            key={orderId}
                            className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden"
                        >
                            <div className="px-4 py-3 bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
                                <div>
                                    <span className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                                        {group.ref}
                                    </span>
                                    <span className="text-gray-500 dark:text-zinc-400 text-sm ml-3">
                                        {group.company}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-400 dark:text-zinc-500">
                                    {group.items.length} insumo{group.items.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {group.items.map((report) => (
                                    <div
                                        key={report.id}
                                        className={`px-4 py-3 flex items-center gap-4 ${
                                            report.resolved
                                                ? 'opacity-60'
                                                : ''
                                        }`}
                                    >
                                        <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                                report.resolved
                                                    ? 'bg-green-100 dark:bg-green-950/50 text-green-600 dark:text-green-400'
                                                    : 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                                            }`}
                                        >
                                            {report.resolved ? (
                                                <CheckCircle2 size={16} />
                                            ) : (
                                                <AlertTriangle size={16} />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">
                                                {report.insumo_name}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-zinc-400">
                                                Necesita: {report.required_qty} · Faltante:{' '}
                                                <span className="font-bold text-red-600 dark:text-red-400">
                                                    {report.missing_qty}
                                                </span>
                                            </p>
                                            {report.notes && (
                                                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 italic">
                                                    {report.notes}
                                                </p>
                                            )}
                                            <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">
                                                {new Date(report.created_at).toLocaleString()}
                                            </p>
                                        </div>

                                        <div className="shrink-0">
                                            {report.resolved ? (
                                                <button
                                                    onClick={() => handleUnresolve(report.id)}
                                                    disabled={pending}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                                                >
                                                    <Undo2 size={12} />
                                                    Reabrir
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleResolve(report.id)}
                                                    disabled={pending}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-950/30 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50"
                                                >
                                                    <CheckCircle2 size={12} />
                                                    Resolver
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
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
