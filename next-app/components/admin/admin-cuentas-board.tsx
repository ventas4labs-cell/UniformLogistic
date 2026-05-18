'use client';

import { useMemo, useState } from 'react';
import {
    AlertTriangle,
    Calendar,
    ChevronDown,
    ChevronRight,
    Clock,
    Receipt,
    Search,
    Wallet
} from 'lucide-react';
import type { CompanyInvoiceGroup, InvoiceRow } from '@/lib/services/invoices';

const fmtCRC = (n: number) =>
    new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: 'CRC',
        maximumFractionDigits: 0
    }).format(n);

const fmtInt = (n: number) => new Intl.NumberFormat('es-CR').format(n);

type Filter = 'all' | 'overdue' | 'pending';

export function AdminCuentasBoard({ groups }: { groups: CompanyInvoiceGroup[] }) {
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    // Apply invoice-level filter inside each group, recompute summary.
    const filteredGroups = useMemo(() => {
        const q = query.trim().toLowerCase();
        return groups
            .map((g) => {
                let invoices = g.invoices;
                if (filter === 'overdue') {
                    invoices = invoices.filter(
                        (i) => i.isOverdueByDate || i.status === 'overdue'
                    );
                } else if (filter === 'pending') {
                    invoices = invoices.filter(
                        (i) =>
                            (i.status === 'pending' || i.status === 'partially_paid') &&
                            !i.isOverdueByDate
                    );
                }
                if (q) {
                    invoices = invoices.filter((i) => {
                        return (
                            g.company.name.toLowerCase().includes(q) ||
                            i.invoiceNumber.toLowerCase().includes(q) ||
                            (i.orderRef || '').toLowerCase().includes(q)
                        );
                    });
                }
                let totalBalance = 0;
                let overdueBalance = 0;
                let pending = 0;
                let overdue = 0;
                let paid = 0;
                let nextDueDate: string | null = null;
                invoices.forEach((i) => {
                    if (i.status === 'paid') paid += 1;
                    else if (i.status === 'overdue' || i.isOverdueByDate) {
                        overdue += 1;
                        overdueBalance += i.balance;
                        totalBalance += i.balance;
                    } else if (i.status === 'pending' || i.status === 'partially_paid') {
                        pending += 1;
                        totalBalance += i.balance;
                        if (!nextDueDate || i.dueDate < nextDueDate) nextDueDate = i.dueDate;
                    }
                });
                return {
                    ...g,
                    invoices,
                    summary: {
                        totalInvoices: invoices.length,
                        pending,
                        overdue,
                        paid,
                        totalBalance,
                        overdueBalance,
                        nextDueDate
                    }
                };
            })
            .filter((g) => g.invoices.length > 0)
            .sort((a, b) => {
                if (b.summary.overdueBalance !== a.summary.overdueBalance)
                    return b.summary.overdueBalance - a.summary.overdueBalance;
                if (b.summary.totalBalance !== a.summary.totalBalance)
                    return b.summary.totalBalance - a.summary.totalBalance;
                return a.company.name.localeCompare(b.company.name, 'es');
            });
    }, [groups, query, filter]);

    // Org-wide totals
    const totals = useMemo(() => {
        let receivable = 0;
        let overdue = 0;
        let pendingCount = 0;
        let overdueCount = 0;
        let maxDaysOverdue = 0;
        filteredGroups.forEach((g) => {
            receivable += g.summary.totalBalance;
            overdue += g.summary.overdueBalance;
            pendingCount += g.summary.pending;
            overdueCount += g.summary.overdue;
            g.invoices.forEach((i) => {
                if (i.daysOverdue > maxDaysOverdue) maxDaysOverdue = i.daysOverdue;
            });
        });
        return {
            companies: filteredGroups.length,
            receivable,
            overdue,
            pendingCount,
            overdueCount,
            maxDaysOverdue
        };
    }, [filteredGroups]);

    const toggle = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const expandAll = () =>
        setExpanded(new Set(filteredGroups.map((g) => g.company.id)));
    const collapseAll = () => setExpanded(new Set());

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                        Cuentas por cobrar
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Estado de cuenta de todas las empresas clientes.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <button
                        onClick={expandAll}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 font-semibold"
                    >
                        Expandir todo
                    </button>
                    <button
                        onClick={collapseAll}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 font-semibold"
                    >
                        Colapsar
                    </button>
                </div>
            </div>

            {/* KPI strip */}
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                <Kpi
                    label="Empresas con saldo"
                    value={fmtInt(totals.companies)}
                    Icon={Wallet}
                    accent="zinc"
                />
                <Kpi
                    label="Por cobrar"
                    value={fmtCRC(totals.receivable)}
                    Icon={Wallet}
                    accent="orange"
                />
                <Kpi
                    label="Vencido"
                    value={fmtCRC(totals.overdue)}
                    Icon={AlertTriangle}
                    accent={totals.overdue > 0 ? 'red' : 'emerald'}
                />
                <Kpi
                    label="Facturas pendientes"
                    value={fmtInt(totals.pendingCount)}
                    sub={`${totals.overdueCount} vencidas`}
                    Icon={Receipt}
                    accent="blue"
                />
                <Kpi
                    label="Atraso máx."
                    value={totals.maxDaysOverdue > 0 ? `${totals.maxDaysOverdue} d` : '—'}
                    Icon={Clock}
                    accent={totals.maxDaysOverdue > 30 ? 'red' : 'zinc'}
                />
            </section>

            {/* Toolbar */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-3 mb-4 flex flex-col sm:flex-row gap-2 sm:items-center border border-gray-200 dark:border-zinc-800">
                <div className="relative flex-1">
                    <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
                    />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar empresa, factura o ORDEN-XXXXX…"
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                </div>
                <div className="flex gap-1">
                    {(['all', 'overdue', 'pending'] as Filter[]).map((f) => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setFilter(f)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                                filter === f
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                        >
                            {f === 'all' ? 'Todas' : f === 'overdue' ? 'Vencidas' : 'Por vencer'}
                        </button>
                    ))}
                </div>
            </div>

            {filteredGroups.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-10 text-center text-gray-500 dark:text-zinc-400 shadow-sm border border-gray-200 dark:border-zinc-800">
                    <Wallet size={32} className="mx-auto mb-2 opacity-30" />
                    Sin facturas para los filtros seleccionados.
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredGroups.map((g) => {
                        const isOpen = expanded.has(g.company.id);
                        const danger = g.summary.overdueBalance > 0;
                        return (
                            <div
                                key={g.company.id}
                                className={`bg-white dark:bg-zinc-900 rounded-xl shadow-sm border overflow-hidden ${
                                    danger
                                        ? 'border-red-200 dark:border-red-900/50'
                                        : 'border-gray-200 dark:border-zinc-800'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => toggle(g.company.id)}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors text-left"
                                >
                                    {isOpen ? (
                                        <ChevronDown size={18} className="text-gray-400 shrink-0" />
                                    ) : (
                                        <ChevronRight size={18} className="text-gray-400 shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-gray-900 dark:text-zinc-100 truncate flex items-center gap-2">
                                            {g.company.name}
                                            {danger && (
                                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 inline-flex items-center gap-1">
                                                    <AlertTriangle size={10} />
                                                    Vencido
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-zinc-400">
                                            {g.summary.pending} pendiente{g.summary.pending === 1 ? '' : 's'} ·{' '}
                                            {g.summary.overdue} vencida{g.summary.overdue === 1 ? '' : 's'} ·{' '}
                                            {g.summary.paid} pagada{g.summary.paid === 1 ? '' : 's'}
                                            {g.summary.nextDueDate && (
                                                <>
                                                    {' · '}
                                                    <span className="inline-flex items-center gap-1">
                                                        <Calendar size={11} />
                                                        Próximo {g.summary.nextDueDate}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-sm font-extrabold text-gray-900 dark:text-zinc-100">
                                            {fmtCRC(g.summary.totalBalance)}
                                        </div>
                                        <div
                                            className={`text-[11px] font-semibold ${
                                                danger
                                                    ? 'text-red-600 dark:text-red-400'
                                                    : 'text-gray-400 dark:text-zinc-500'
                                            }`}
                                        >
                                            {danger
                                                ? `Vencido ${fmtCRC(g.summary.overdueBalance)}`
                                                : 'Al día'}
                                        </div>
                                    </div>
                                </button>

                                {isOpen && (
                                    <InvoiceTable invoices={g.invoices} />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Subcomponents ───────────────────────────────────────────────────────

function InvoiceTable({ invoices }: { invoices: InvoiceRow[] }) {
    return (
        <div className="border-t border-gray-100 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-zinc-900/60 text-xs font-semibold text-gray-600 dark:text-zinc-400">
                    <tr>
                        <th className="p-3">Factura</th>
                        <th className="p-3">Pedido</th>
                        <th className="p-3">Emisión</th>
                        <th className="p-3">Vencimiento</th>
                        <th className="p-3 text-right">Total</th>
                        <th className="p-3 text-right">Pagado</th>
                        <th className="p-3 text-right">Saldo</th>
                        <th className="p-3">Estado</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {invoices.map((i) => (
                        <tr
                            key={i.id}
                            className="hover:bg-gray-50 dark:hover:bg-zinc-800/60"
                        >
                            <td className="p-3 font-mono text-xs text-gray-700 dark:text-zinc-300">
                                {i.invoiceNumber}
                            </td>
                            <td className="p-3 font-mono text-xs text-gray-500 dark:text-zinc-400">
                                {i.orderRef || '—'}
                            </td>
                            <td className="p-3 text-gray-600 dark:text-zinc-400">{i.issuedDate}</td>
                            <td className="p-3 text-gray-600 dark:text-zinc-400">
                                {i.dueDate}
                                {i.isOverdueByDate && (
                                    <span className="ml-1 text-[10px] font-bold text-red-600 dark:text-red-400">
                                        ({i.daysOverdue}d)
                                    </span>
                                )}
                            </td>
                            <td className="p-3 text-right text-gray-900 dark:text-zinc-100 font-semibold">
                                {fmtCRC(i.total)}
                            </td>
                            <td className="p-3 text-right text-gray-500 dark:text-zinc-400">
                                {i.paidAmount > 0 ? fmtCRC(i.paidAmount) : '—'}
                            </td>
                            <td
                                className={`p-3 text-right font-bold ${
                                    i.balance > 0
                                        ? i.isOverdueByDate
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-gray-900 dark:text-zinc-100'
                                        : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                            >
                                {fmtCRC(i.balance)}
                            </td>
                            <td className="p-3">
                                <StatusPill row={i} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function StatusPill({ row }: { row: InvoiceRow }) {
    let label: string = row.status;
    let cls = 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300';
    if (row.status === 'paid') {
        label = 'Pagada';
        cls = 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300';
    } else if (row.status === 'partially_paid') {
        label = 'Parcial';
        cls = 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300';
    } else if (row.status === 'overdue' || row.isOverdueByDate) {
        label = 'Vencida';
        cls = 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300';
    } else if (row.status === 'pending') {
        label = 'Pendiente';
        cls = 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300';
    } else if (row.status === 'cancelled') {
        label = 'Cancelada';
        cls = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400';
    } else if (row.status === 'draft') {
        label = 'Borrador';
        cls = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400';
    }
    return (
        <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${cls}`}>
            {label}
        </span>
    );
}

function Kpi({
    label,
    value,
    sub,
    Icon,
    accent
}: {
    label: string;
    value: string;
    sub?: string;
    Icon: React.ComponentType<{ size?: number }>;
    accent: 'orange' | 'emerald' | 'zinc' | 'blue' | 'red';
}) {
    const ring =
        accent === 'orange'
            ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
            : accent === 'emerald'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
              : accent === 'blue'
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                : accent === 'red'
                  ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300';
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
                {sub && (
                    <div className="text-[11px] text-gray-500 dark:text-zinc-400">{sub}</div>
                )}
            </div>
        </div>
    );
}
