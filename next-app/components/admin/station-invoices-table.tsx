'use client';

import { useMemo, useState } from 'react';
import { Receipt, Search, ImageIcon, X } from 'lucide-react';
import type {
    StationInvoice,
    StationInvoiceStatus
} from '@/lib/services/station-invoices';

interface Props {
    initialInvoices: StationInvoice[];
}

const STATUS_LABEL: Record<StationInvoiceStatus, string> = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    rejected: 'Rechazada'
};

const STATUS_CLS: Record<StationInvoiceStatus, string> = {
    pending: 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300',
    approved: 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300',
    rejected: 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300'
};

const formatAmount = (n: number | null) =>
    n == null ? '—' : n.toLocaleString('es-CR', { minimumFractionDigits: 2 });

export function StationInvoicesTable({ initialInvoices }: Props) {
    const [invoices] = useState<StationInvoice[]>(initialInvoices);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StationInvoiceStatus | 'all'>('all');
    const [preview, setPreview] = useState<{ src: string; alt: string } | null>(null);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return invoices.filter((i) => {
            if (statusFilter !== 'all' && i.status !== statusFilter) return false;
            if (!term) return true;
            return (
                (i.stationDisplayName || '').toLowerCase().includes(term) ||
                (i.stationStage || '').toLowerCase().includes(term) ||
                (i.notes || '').toLowerCase().includes(term) ||
                (i.orderRef || '').toLowerCase().includes(term)
            );
        });
    }, [invoices, search, statusFilter]);

    const counts = {
        all: invoices.length,
        pending: invoices.filter((i) => i.status === 'pending').length,
        approved: invoices.filter((i) => i.status === 'approved').length,
        rejected: invoices.filter((i) => i.status === 'rejected').length
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <Receipt size={24} className="text-orange-600 dark:text-orange-400" />
                        Facturas de estaciones
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Facturas enviadas por contratistas externos desde sus estaciones.
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
                {(
                    [
                        ['all', 'Todas'],
                        ['pending', 'Pendientes'],
                        ['approved', 'Aprobadas'],
                        ['rejected', 'Rechazadas']
                    ] as [StationInvoiceStatus | 'all', string][]
                ).map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setStatusFilter(key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                            statusFilter === key
                                ? 'bg-orange-600 text-white shadow-sm'
                                : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                        }`}
                    >
                        {label} ({counts[key === 'all' ? 'all' : key]})
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm mb-4">
                <div className="relative w-full max-w-md">
                    <Search
                        className="absolute left-3 top-2.5 text-gray-400 dark:text-zinc-500"
                        size={18}
                    />
                    <input
                        type="text"
                        placeholder="Buscar por estación, etapa, nota o pedido…"
                        className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-transparent"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-200 dark:border-zinc-800">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400 w-16"></th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Estación</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Etapa</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Pedido</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400 text-right">Monto</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Nota</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Estado</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Enviada</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {filtered.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="p-8 text-center text-gray-500 dark:text-zinc-400"
                                >
                                    <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                                    {invoices.length === 0
                                        ? 'Todavía no hay facturas enviadas.'
                                        : 'Ningún resultado para los filtros actuales.'}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((i) => (
                                <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                    <td className="p-4">
                                        {i.imageUrl ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPreview({
                                                        src: i.imageUrl,
                                                        alt:
                                                            i.stationDisplayName ||
                                                            'Factura'
                                                    })
                                                }
                                                className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 hover:ring-2 hover:ring-orange-400 transition-all cursor-pointer bg-white"
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={i.imageUrl}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </button>
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                                                <ImageIcon
                                                    size={16}
                                                    className="text-gray-300 dark:text-zinc-600"
                                                />
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 font-bold text-gray-900 dark:text-zinc-100">
                                        {i.stationDisplayName || '—'}
                                    </td>
                                    <td className="p-4 text-gray-600 dark:text-zinc-400 text-sm capitalize">
                                        {i.stationStage || '—'}
                                    </td>
                                    <td className="p-4 font-mono text-xs text-gray-500 dark:text-zinc-400">
                                        {i.orderRef || '—'}
                                    </td>
                                    <td className="p-4 text-right font-mono text-gray-700 dark:text-zinc-300">
                                        {formatAmount(i.amount)}
                                    </td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-zinc-400 max-w-xs truncate">
                                        {i.notes || '—'}
                                    </td>
                                    <td className="p-4">
                                        <span
                                            className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_CLS[i.status]}`}
                                        >
                                            {STATUS_LABEL[i.status]}
                                        </span>
                                    </td>
                                    <td className="p-4 text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                                        {new Date(i.submittedAt).toLocaleString('es-CR', {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {preview && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    onClick={() => setPreview(null)}
                >
                    <div
                        className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden max-w-3xl w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setPreview(null)}
                            className="absolute top-3 right-3 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
                        >
                            <X size={18} />
                        </button>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={preview.src}
                            alt={preview.alt}
                            className="w-full h-auto max-h-[80vh] object-contain bg-white"
                        />
                        <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800">
                            <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">
                                {preview.alt}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
