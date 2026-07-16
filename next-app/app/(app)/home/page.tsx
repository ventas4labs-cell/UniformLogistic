import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
    AlertTriangle,
    ArrowRight,
    Boxes,
    Factory,
    Inbox,
    LogOut,
    ShieldCheck,
    Truck,
    Wallet
} from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { isAdminEmail } from '@/lib/admin-acting-company';
import { signOutAction } from '@/app/login/actions';
import { fetchUserOrders } from '@/lib/services/orders';
import { fetchStageCompletionsForOrders } from '@/lib/services/stage-completions';
import { fetchDispatchTotalsForOrders } from '@/lib/services/dispatches';
import { fetchStockEntryTotalsForOrders } from '@/lib/services/stock-entries';
import { fetchDeliveriesForOrders } from '@/lib/services/deliveries';
import { deriveOrderProgress, type CustomerOrderProgress } from '@/lib/customer-order-status';
import { fetchStockForUser, summarizeStock } from '@/lib/services/stock';
import { fetchInvoicesForUser, summarizeInvoices } from '@/lib/services/invoices';
import { OrderCard } from '@/components/customer/order-card';
import { ThemeToggle } from '@/components/theme-toggle';
import type { Order } from '@/lib/types';

const fmtCRC = (n: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n);

const Mini = ({
    label,
    value,
    sub,
    tone
}: {
    label: string;
    value: string;
    sub?: string;
    tone?: 'red';
}) => (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-2.5">
        <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 font-semibold">
            {label}
        </div>
        <div
            className={`text-base font-extrabold leading-tight mt-0.5 truncate ${
                tone === 'red'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-zinc-900 dark:text-zinc-100'
            }`}
        >
            {value}
        </div>
        {sub && <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{sub}</div>}
    </div>
);

export default async function HomePage() {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return null;

    // The admin has their own panel home (/admin/home) — never show them
    // the customer warehouse dashboard, even on a direct visit.
    if (isAdminEmail(user.email)) redirect('/admin/home');

    const [allOrders, stockRows, invoices] = await Promise.all([
        fetchUserOrders(supabase, user.id),
        fetchStockForUser(supabase, user.id),
        fetchInvoicesForUser(supabase, user.id)
    ]);
    const stockSummary = summarizeStock(stockRows);
    const invoiceSummary = summarizeInvoices(invoices);

    // Real production progress lives in order_stage_completions (parallel
    // stages) + order_dispatches (delivery) — not orders.status. Derive
    // each order's true bucket from those.
    const orderIds = allOrders.map((o) => o.uuid).filter((id): id is string => !!id);
    const [completions, dispatchTotals, stockTotals, deliveries] = await Promise.all([
        fetchStageCompletionsForOrders(supabase, orderIds),
        fetchDispatchTotalsForOrders(supabase, orderIds),
        fetchStockEntryTotalsForOrders(supabase, orderIds),
        fetchDeliveriesForOrders(supabase, orderIds)
    ]);
    const progressByOrder = new Map<string, CustomerOrderProgress>();
    for (const o of allOrders) {
        if (o.uuid) {
            progressByOrder.set(
                o.uuid,
                deriveOrderProgress(
                    o,
                    completions,
                    dispatchTotals,
                    stockTotals,
                    !!deliveries.get(o.uuid)?.deliveredAt
                )
            );
        }
    }
    const bucketOf = (o: Order) =>
        o.uuid ? progressByOrder.get(o.uuid)?.bucket : undefined;

    const inProduction = allOrders.filter((o) => bucketOf(o) === 'production');
    const readyToDispatch = allOrders.filter((o) => bucketOf(o) === 'ready');
    const completed = allOrders.filter((o) => bucketOf(o) === 'completed');

    const piecesInProduction = inProduction.reduce(
        (s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0),
        0
    );
    const piecesReady = readyToDispatch.reduce(
        (s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0),
        0
    );

    const greetingName =
        (user.user_metadata?.company_name as string | undefined) ||
        (user.user_metadata?.full_name as string | undefined) ||
        user.email ||
        '';

    return (
        <div className="space-y-8">
            {/* ── Header ───────────────────────────────────────────── */}
            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-widest font-semibold text-orange-600 dark:text-orange-400">
                        Mi almacén
                    </p>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 mt-1">
                        Hola{greetingName ? `, ${greetingName}` : ''}
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                        {inProduction.length + readyToDispatch.length} pedido
                        {inProduction.length + readyToDispatch.length === 1 ? '' : 's'} activo
                        {inProduction.length + readyToDispatch.length === 1 ? '' : 's'} ·{' '}
                        {piecesInProduction + piecesReady} pieza
                        {piecesInProduction + piecesReady === 1 ? '' : 's'} en flujo
                    </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Link
                        href="/catalog"
                        className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold px-5 py-3 rounded-xl shadow-md hover:shadow-orange-500/20 transition-all"
                    >
                        + Hacer un nuevo pedido
                        <ArrowRight size={18} />
                    </Link>
                    <ThemeToggle className="!p-3" />
                    <form action={signOutAction}>
                        <button
                            type="submit"
                            className="inline-flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 text-zinc-700 dark:text-zinc-300 font-semibold px-4 py-3 rounded-xl transition-all"
                            title="Cerrar sesión"
                        >
                            <LogOut size={16} />
                            <span className="hidden sm:inline">Salir</span>
                        </button>
                    </form>
                </div>
            </header>

            {/* ── KPI strip ────────────────────────────────────────── */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                    label="En producción"
                    value={inProduction.length}
                    sub={`${piecesInProduction} piezas`}
                    Icon={Factory}
                    accent="orange"
                />
                <KpiCard
                    label="Listos para despacho"
                    value={readyToDispatch.length}
                    sub={`${piecesReady} piezas`}
                    Icon={Truck}
                    accent="emerald"
                />
                <KpiCard
                    label="Completados"
                    value={completed.length}
                    sub="histórico"
                    Icon={ShieldCheck}
                    accent="zinc"
                />
                <KpiCard
                    label="Total de pedidos"
                    value={allOrders.length}
                    sub="todos"
                    Icon={Inbox}
                    accent="zinc"
                />
            </section>

            {/* ── Two-column status board ──────────────────────────── */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Column
                    title="En producción"
                    subtitle="Tus pedidos avanzando en el taller."
                    Icon={Factory}
                    accent="orange"
                    orders={inProduction}
                    progressByOrder={progressByOrder}
                    empty="Ningún pedido en producción ahora mismo."
                />
                <Column
                    title="Listos para despacho"
                    subtitle="Empacados y esperando entrega."
                    Icon={Truck}
                    accent="emerald"
                    orders={readyToDispatch}
                    progressByOrder={progressByOrder}
                    empty="Aún no hay pedidos listos para despacho."
                />
            </section>

            {/* ── Stock + Cuentas summary ──────────────────────────── */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Link
                    href="/stock"
                    className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-orange-200 dark:hover:border-orange-500/40 hover:shadow-md transition-all"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                            <Boxes size={18} />
                        </div>
                        <div className="flex-1">
                            <h2 className="font-bold text-zinc-900 dark:text-zinc-100">Stock en bodega</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Uniformes guardados a tu nombre.</p>
                        </div>
                        <ArrowRight
                            size={16}
                            className="text-zinc-400 dark:text-zinc-500 group-hover:text-orange-600 dark:group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all"
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                        <Mini
                            label="Productos"
                            value={stockSummary.byProduct.size.toString()}
                            sub={`${stockSummary.skuCount} SKUs`}
                        />
                        <Mini
                            label="Piezas"
                            value={stockSummary.totalOnHand.toLocaleString('es-CR')}
                            sub={`${stockSummary.totalAvailable.toLocaleString('es-CR')} libres`}
                        />
                        <Mini
                            label="Valor"
                            value={fmtCRC(stockSummary.estimatedValue)}
                        />
                    </div>
                </Link>

                <Link
                    href="/cuentas"
                    className={`group rounded-2xl border p-5 hover:shadow-md transition-all ${
                        invoiceSummary.overdue > 0
                            ? 'border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 hover:border-red-300 dark:hover:border-red-700'
                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-orange-200 dark:hover:border-orange-500/40'
                    }`}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                invoiceSummary.overdue > 0
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            }`}
                        >
                            {invoiceSummary.overdue > 0 ? (
                                <AlertTriangle size={18} />
                            ) : (
                                <Wallet size={18} />
                            )}
                        </div>
                        <div className="flex-1">
                            <h2 className="font-bold text-zinc-900 dark:text-zinc-100">Cuentas con Uniform Logistic</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {invoiceSummary.overdue > 0
                                    ? 'Tienes pagos vencidos.'
                                    : 'Estado de cuenta al día.'}
                            </p>
                        </div>
                        <ArrowRight
                            size={16}
                            className="text-zinc-400 dark:text-zinc-500 group-hover:text-orange-600 dark:group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all"
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                        <Mini
                            label="Por cobrar"
                            value={fmtCRC(invoiceSummary.totalBalance)}
                            sub={`${invoiceSummary.pending + invoiceSummary.overdue} fact.`}
                        />
                        <Mini
                            label="Vencido"
                            value={fmtCRC(invoiceSummary.overdueBalance)}
                            sub={`${invoiceSummary.overdue} factura${invoiceSummary.overdue === 1 ? '' : 's'}`}
                            tone={invoiceSummary.overdue > 0 ? 'red' : undefined}
                        />
                        <Mini
                            label="Próximo vence"
                            value={invoiceSummary.nextDueDate || '—'}
                        />
                    </div>
                </Link>
            </section>

            {/* ── Completados (collapsed) ──────────────────────────── */}
            {completed.length > 0 && (
                <section>
                    <div className="flex items-end justify-between mb-3">
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                Pedidos completados
                            </h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Los últimos {Math.min(completed.length, 4)} entregados.
                            </p>
                        </div>
                        <Link
                            href="/orders"
                            className="text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-semibold inline-flex items-center gap-1"
                        >
                            Ver todo el historial <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {completed.slice(0, 4).map((o) => {
                            const p = o.uuid ? progressByOrder.get(o.uuid) : undefined;
                            return p ? (
                                <OrderCard key={o.uuid || o.id} order={o} progress={p} />
                            ) : null;
                        })}
                    </div>
                </section>
            )}

        </div>
    );
}

// ── Subcomponents ───────────────────────────────────────────────────────

function Column({
    title,
    subtitle,
    Icon,
    accent,
    orders,
    progressByOrder,
    empty
}: {
    title: string;
    subtitle: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    accent: 'orange' | 'emerald';
    orders: Order[];
    progressByOrder: Map<string, CustomerOrderProgress>;
    empty: string;
}) {
    const headerCls =
        accent === 'orange'
            ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-900/50'
            : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900/50';

    return (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className={`flex items-center gap-3 px-4 py-3 border-b ${headerCls}`}>
                <Icon size={18} />
                <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-sm">{title}</h2>
                    <p className="text-xs opacity-80">{subtitle}</p>
                </div>
                <span className="text-xs font-bold bg-white/70 dark:bg-zinc-900/70 px-2 py-0.5 rounded-full">
                    {orders.length}
                </span>
            </div>
            <div className="p-3 space-y-3 min-h-[120px]">
                {orders.length === 0 ? (
                    <div className="text-sm text-zinc-400 dark:text-zinc-500 italic px-3 py-6 text-center">
                        {empty}
                    </div>
                ) : (
                    orders.map((o) => {
                        const p = o.uuid ? progressByOrder.get(o.uuid) : undefined;
                        return p ? (
                            <OrderCard key={o.uuid || o.id} order={o} progress={p} />
                        ) : null;
                    })
                )}
            </div>
        </div>
    );
}

function KpiCard({
    label,
    value,
    sub,
    Icon,
    accent
}: {
    label: string;
    value: number;
    sub: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    accent: 'orange' | 'emerald' | 'zinc';
}) {
    const ring =
        accent === 'orange'
            ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
            : accent === 'emerald'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300';
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ring}`}>
                <Icon size={18} />
            </div>
            <div className="min-w-0">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">{label}</div>
                <div className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 leading-none mt-0.5">
                    {value}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{sub}</div>
            </div>
        </div>
    );
}
