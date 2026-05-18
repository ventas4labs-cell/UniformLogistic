import { AlertTriangle, Calendar, CheckCircle2, Clock, Hash, Receipt, Search, Wallet } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { fetchInvoicesForUser, summarizeInvoices, type InvoiceRow } from '@/lib/services/invoices';

const fmtCRC = (n: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n);

interface Props {
    searchParams: Promise<{ q?: string }>;
}

export default async function CuentasPage({ searchParams }: Props) {
    const { q: rawQ } = await searchParams;
    const q = (rawQ || '').trim();

    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return null;

    const all = await fetchInvoicesForUser(supabase, user.id);
    const summary = summarizeInvoices(all);

    const filtered = q
        ? all.filter((inv) => {
              const needle = q.toLowerCase();
              return (
                  inv.invoiceNumber.toLowerCase().includes(needle) ||
                  (inv.orderRef || '').toLowerCase().includes(needle) ||
                  inv.orderRef?.replace('ORDEN-', '').toLowerCase().includes(needle)
              );
          })
        : all;

    const overdue = filtered.filter((i) => i.status === 'overdue' || i.isOverdueByDate);
    const pending = filtered.filter(
        (i) =>
            !overdue.includes(i) &&
            (i.status === 'pending' || i.status === 'partially_paid')
    );
    const paid = filtered.filter((i) => i.status === 'paid');
    const cancelled = filtered.filter((i) => i.status === 'cancelled');

    return (
        <div className="space-y-8">
            <header>
                <p className="text-xs uppercase tracking-widest font-semibold text-orange-600">
                    Cuentas
                </p>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 mt-1">
                    Pagos y facturación
                </h1>
                <p className="text-zinc-500 text-sm mt-1">
                    Estado de cuenta con Uniform Logistic. Busca por número de orden o de
                    factura.
                </p>
            </header>

            {/* KPIs */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi
                    label="Por cobrar"
                    value={fmtCRC(summary.totalBalance)}
                    sub={`${summary.pending + summary.overdue} factura${summary.pending + summary.overdue === 1 ? '' : 's'} con saldo`}
                    Icon={Wallet}
                    accent="orange"
                />
                <Kpi
                    label="Vencido"
                    value={fmtCRC(summary.overdueBalance)}
                    sub={`${summary.overdue} factura${summary.overdue === 1 ? '' : 's'} vencida${summary.overdue === 1 ? '' : 's'}`}
                    Icon={AlertTriangle}
                    accent="red"
                />
                <Kpi
                    label="Próxima fecha"
                    value={summary.nextDueDate || '—'}
                    sub="vencimiento más cercano"
                    Icon={Calendar}
                    accent="blue"
                />
                <Kpi
                    label="Pagadas"
                    value={summary.paid.toString()}
                    sub="al día histórico"
                    Icon={CheckCircle2}
                    accent="emerald"
                />
            </section>

            {/* Search */}
            <form className="bg-white rounded-2xl border border-zinc-200 p-3 flex items-center gap-2">
                <Search size={16} className="text-zinc-400 ml-2" />
                <input
                    name="q"
                    defaultValue={q}
                    placeholder="Buscar por número de orden (ORDEN-00005) o factura (FAC-00001)…"
                    className="flex-1 px-2 py-2 text-sm outline-none"
                />
                <button
                    type="submit"
                    className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold px-4 py-2 rounded-lg"
                >
                    Buscar
                </button>
                {q && (
                    <a
                        href="/cuentas"
                        className="text-sm text-zinc-500 hover:text-zinc-700 font-semibold px-2"
                    >
                        Limpiar
                    </a>
                )}
            </form>

            {/* Sections */}
            {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center text-zinc-500">
                    <Receipt size={36} className="mx-auto mb-3 opacity-30" />
                    {q
                        ? `No encontramos facturas que coincidan con "${q}".`
                        : 'No tienes facturas registradas todavía.'}
                </div>
            ) : (
                <>
                    {overdue.length > 0 && (
                        <InvoiceList
                            title="Vencidas"
                            subtitle="Pagos atrasados — contacta a Uniform Logistic para regularizar."
                            tone="red"
                            invoices={overdue}
                        />
                    )}
                    {pending.length > 0 && (
                        <InvoiceList
                            title="Pendientes"
                            subtitle="Facturas con saldo dentro del plazo."
                            tone="orange"
                            invoices={pending}
                        />
                    )}
                    {paid.length > 0 && (
                        <InvoiceList
                            title="Pagadas"
                            subtitle="Histórico de facturas saldadas."
                            tone="emerald"
                            invoices={paid}
                        />
                    )}
                    {cancelled.length > 0 && (
                        <InvoiceList
                            title="Anuladas"
                            tone="zinc"
                            invoices={cancelled}
                        />
                    )}
                </>
            )}
        </div>
    );
}

function InvoiceList({
    title,
    subtitle,
    tone,
    invoices
}: {
    title: string;
    subtitle?: string;
    tone: 'red' | 'orange' | 'emerald' | 'zinc';
    invoices: InvoiceRow[];
}) {
    const headerCls =
        tone === 'red'
            ? 'bg-red-50 text-red-900 border-red-200'
            : tone === 'orange'
              ? 'bg-orange-50 text-orange-900 border-orange-200'
              : tone === 'emerald'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-zinc-50 text-zinc-700 border-zinc-200';

    return (
        <section className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
            <div className={`px-4 py-3 border-b ${headerCls}`}>
                <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-bold text-sm">{title}</h2>
                    <span className="text-xs font-bold bg-white/70 px-2 py-0.5 rounded-full">
                        {invoices.length}
                    </span>
                </div>
                {subtitle && <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>}
            </div>
            <div className="divide-y divide-zinc-100">
                {invoices.map((inv) => (
                    <InvoiceRowItem key={inv.id} inv={inv} />
                ))}
            </div>
        </section>
    );
}

function InvoiceRowItem({ inv }: { inv: InvoiceRow }) {
    const isOverdue = inv.status === 'overdue' || inv.isOverdueByDate;
    const statusBadge = (() => {
        if (inv.status === 'paid')
            return { cls: 'bg-emerald-100 text-emerald-800', label: 'Pagada', Icon: CheckCircle2 };
        if (isOverdue)
            return {
                cls: 'bg-red-100 text-red-800',
                label: `Vencida · ${inv.daysOverdue}d`,
                Icon: AlertTriangle
            };
        if (inv.status === 'partially_paid')
            return { cls: 'bg-amber-100 text-amber-800', label: 'Pago parcial', Icon: Clock };
        if (inv.status === 'cancelled')
            return { cls: 'bg-zinc-100 text-zinc-600', label: 'Anulada', Icon: Clock };
        return { cls: 'bg-blue-100 text-blue-800', label: 'Pendiente', Icon: Clock };
    })();
    const Icon = statusBadge.Icon;
    return (
        <div className="p-4 hover:bg-zinc-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-zinc-900 font-mono">
                            {inv.invoiceNumber}
                        </span>
                        {inv.orderRef && (
                            <span className="inline-flex items-center gap-1 text-xs font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                                <Hash size={10} /> {inv.orderRef}
                            </span>
                        )}
                        <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${statusBadge.cls}`}
                        >
                            <Icon size={11} />
                            {statusBadge.label}
                        </span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1 flex flex-wrap gap-3">
                        <span>Emitida {inv.issuedDate}</span>
                        <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                            Vence {inv.dueDate}
                        </span>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <div className="text-[11px] text-zinc-500 uppercase font-semibold tracking-wide">
                        Total
                    </div>
                    <div className="text-lg font-extrabold text-zinc-900">{fmtCRC(inv.total)}</div>
                    {inv.paidAmount > 0 && inv.paidAmount < inv.total && (
                        <div className="text-xs text-emerald-700 font-semibold">
                            Pagado {fmtCRC(inv.paidAmount)}
                        </div>
                    )}
                    {inv.balance > 0 && (
                        <div
                            className={`text-xs font-bold ${isOverdue ? 'text-red-600' : 'text-orange-600'}`}
                        >
                            Saldo {fmtCRC(inv.balance)}
                        </div>
                    )}
                </div>
            </div>
        </div>
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
    sub: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    accent: 'orange' | 'red' | 'blue' | 'emerald';
}) {
    const ring =
        accent === 'orange'
            ? 'bg-orange-50 text-orange-700'
            : accent === 'red'
              ? 'bg-red-50 text-red-700'
              : accent === 'blue'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-emerald-50 text-emerald-700';
    return (
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ring}`}>
                <Icon size={18} />
            </div>
            <div className="min-w-0">
                <div className="text-xs text-zinc-500 font-medium truncate">{label}</div>
                <div className="text-lg font-extrabold text-zinc-900 leading-tight mt-0.5 truncate">
                    {value}
                </div>
                <div className="text-[11px] text-zinc-500 truncate">{sub}</div>
            </div>
        </div>
    );
}
