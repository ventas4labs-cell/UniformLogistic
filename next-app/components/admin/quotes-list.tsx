'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, Search, Building2, User, Calendar, Globe } from 'lucide-react';
import { QUOTE_STATUS_OPTIONS, type QuoteSummary } from '@/lib/services/quotes';

const formatCurrency = (n: number, currency: string) =>
    new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
    }).format(n);

export function QuotesList({ initialQuotes }: { initialQuotes: QuoteSummary[] }) {
    const [search, setSearch] = useState('');

    const filtered = initialQuotes.filter((q) => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return (
            q.quoteRef.toLowerCase().includes(term) ||
            q.clientName.toLowerCase().includes(term) ||
            q.companyName.toLowerCase().includes(term)
        );
    });

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <FileText size={24} className="text-orange-600 dark:text-orange-400" />
                        Cotizador
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Cotizaciones para prospectos, armadas desde el
                        catálogo default.
                    </p>
                </div>
                <Link
                    href="/admin/cotizador/nuevo"
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md flex items-center gap-2"
                >
                    <Plus size={18} /> Nueva cotización
                </Link>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-4 mb-4">
                <div className="relative max-w-md">
                    <Search
                        className="absolute left-3 top-3 text-gray-400 dark:text-zinc-500"
                        size={18}
                    />
                    <input
                        type="text"
                        placeholder="Buscar por número, cliente o empresa…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400">
                    {initialQuotes.length === 0
                        ? 'Sin cotizaciones. Creá la primera con "Nueva cotización".'
                        : 'Ningún resultado para la búsqueda.'}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map((q) => {
                        const statusOpt = QUOTE_STATUS_OPTIONS.find(
                            (s) => s.value === q.status
                        );
                        return (
                            <Link
                                key={q.id}
                                href={`/admin/cotizador/${q.id}`}
                                className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 hover:shadow-md hover:border-orange-200 dark:hover:border-orange-900/60 transition-all p-4 flex flex-col gap-3"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <span className="font-mono text-base font-bold text-orange-600 dark:text-orange-400 inline-flex items-center gap-1.5">
                                        {q.quoteRef}
                                        {q.source === 'customer' && (
                                            <span className="inline-flex items-center gap-1 bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                                <Globe size={10} /> Cliente
                                            </span>
                                        )}
                                    </span>
                                    <span
                                        className={`py-1 px-3 rounded-full text-xs font-bold ${statusOpt?.color || 'bg-gray-100 text-gray-800'}`}
                                    >
                                        {statusOpt?.label || q.status}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {q.companyName && (
                                        <p className="font-semibold text-gray-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
                                            <Building2 size={14} className="text-gray-400" />
                                            {q.companyName}
                                        </p>
                                    )}
                                    {q.clientName && (
                                        <p className="text-sm text-gray-600 dark:text-zinc-400 truncate flex items-center gap-1.5">
                                            <User size={14} className="text-gray-400" />
                                            {q.clientName}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-400">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={12} />
                                        {new Date(q.quoteDate).toLocaleDateString()}
                                    </span>
                                    {q.validUntil && (
                                        <span>
                                            Vence:{' '}
                                            {new Date(q.validUntil).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-end justify-between pt-2 border-t border-gray-100 dark:border-zinc-800">
                                    <div className="text-xs text-gray-500 dark:text-zinc-400">
                                        {q.lineCount} líneas · {q.totalPieces} pzas
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-zinc-500">
                                            Total
                                        </div>
                                        <div className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                                            {formatCurrency(q.total, q.currency)}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
