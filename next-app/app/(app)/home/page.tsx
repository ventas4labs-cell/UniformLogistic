import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowRight, Boxes, CheckCircle2, Clock, Receipt } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { isAdminEmail } from '@/lib/admin-acting-company';
import { fetchUserOrders } from '@/lib/services/orders';
import { fetchStageCompletionsForOrders } from '@/lib/services/stage-completions';
import { fetchDispatchTotalsForOrders } from '@/lib/services/dispatches';
import { fetchStockEntryTotalsForOrders } from '@/lib/services/stock-entries';
import { fetchDeliveriesForOrders } from '@/lib/services/deliveries';
import { deriveOrderProgress, type CustomerOrderProgress } from '@/lib/customer-order-status';
import { buildCustomerAnalytics } from '@/lib/customer-analytics';
import {
    fetchStockForUser,
    summarizeStock,
    withdrawablePiecesByOrder
} from '@/lib/services/stock';
import { fetchInvoicesForUser, summarizeInvoices } from '@/lib/services/invoices';
import { OrderCard } from '@/components/customer/order-card';
import { SpendPanel } from '@/components/customer/spend-panel';
import { TopProducts } from '@/components/customer/top-products';
import type { Order } from '@/lib/types';

const fmtCRC = (n: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n);

const fmtNum = (n: number) => n.toLocaleString('es-CR');

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

    // Spending, volume and rankings all come off the orders + invoices
    // already loaded above — the dashboard adds no queries.
    const stats = buildCustomerAnalytics({ orders: allOrders, invoices });

    // Pendiente vs. listo is derived from real production progress
    // (order_stage_completions + order_dispatches), not orders.status —
    // see lib/customer-order-status.ts. The stage-by-stage detail behind
    // it stays internal; the customer only gets the two states.
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
    // Ready orders whose pieces sit in the bodega get a "Retirar" shortcut.
    const withdrawable = withdrawablePiecesByOrder(allOrders, stockTotals, stockRows);

    const bucketOf = (o: Order) =>
        o.uuid ? progressByOrder.get(o.uuid)?.bucket : undefined;

    const pending = allOrders.filter((o) => bucketOf(o) === 'pending');
    const ready = allOrders.filter((o) => bucketOf(o) === 'ready');
    const completed = allOrders.filter((o) => bucketOf(o) === 'completed');

    const greetingName =
        (user.user_metadata?.company_name as string | undefined) ||
        (user.user_metadata?.full_name as string | undefined) ||
        user.email ||
        '';

    const openInvoices = invoiceSummary.pending + invoiceSummary.overdue;

    return (
        <div className="space-y-6 lg:space-y-8">
            {/* ── Header ───────────────────────────────────────────── */}
            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                        Hola{greetingName ? `, ${greetingName}` : ''}
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1.5">
                        {pending.length} pedido{pending.length === 1 ? '' : 's'} pendiente
                        {pending.length === 1 ? '' : 's'} · {ready.length} listo
                        {ready.length === 1 ? '' : 's'} para entrega
                    </p>
                </div>
                <Link
                    href="/catalog"
                    className="inline-flex items-center justify-center gap-2 self-start sm:self-auto bg-orange-600 hover:bg-orange-700 active:bg-orange-700 text-white font-bold px-5 py-3 rounded-xl shadow-sm hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
                >
                    Hacer un nuevo pedido
                    <ArrowRight size={18} />
                </Link>
            </header>

            {/* ── Overdue, only when it's true ─────────────────────── */}
            {invoiceSummary.overdue > 0 && (
                <Link
                    href="/cuentas"
                    className="flex items-center gap-3 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/25 px-4 py-3.5 hover:border-red-300 dark:hover:border-red-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                    <AlertTriangle size={18} className="text-red-600 dark:text-red-400 shrink-0" />
                    <p className="flex-1 text-sm text-red-800 dark:text-red-300">
                        <span className="font-bold">
                            {fmtCRC(invoiceSummary.overdueBalance)} vencido
                        </span>{' '}
                        en {invoiceSummary.overdue} factura
                        {invoiceSummary.overdue === 1 ? '' : 's'}. Revisá tu estado de cuenta.
                    </p>
                    <ArrowRight size={16} className="text-red-500 dark:text-red-400 shrink-0" />
                </Link>
            )}

            {/* ── Spending + twelve months ─────────────────────────── */}
            <SpendPanel stats={stats} />

            {/* ── Order status board ───────────────────────────────── */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <Column
                    title="Pendientes"
                    subtitle="Los estamos preparando."
                    Icon={Clock}
                    accent="orange"
                    orders={pending}
                    progressByOrder={progressByOrder}
                    withdrawable={withdrawable}
                    empty={
                        <>
                            Ningún pedido en preparación.{' '}
                            <Link
                                href="/catalog"
                                className="text-orange-600 dark:text-orange-400 font-semibold hover:underline"
                            >
                                Explorá el catálogo
                            </Link>{' '}
                            para hacer uno.
                        </>
                    }
                />
                <Column
                    title="Listos"
                    subtitle="Terminados y esperando entrega."
                    Icon={CheckCircle2}
                    accent="emerald"
                    orders={ready}
                    progressByOrder={progressByOrder}
                    withdrawable={withdrawable}
                    empty="En cuanto terminemos un pedido lo vas a ver acá."
                />
            </section>

            {/* ── Products, bodega, cuentas ────────────────────────── */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                <TopProducts products={stats.topProducts} />

                <SummaryCard
                    href="/stock"
                    Icon={Boxes}
                    accent="blue"
                    title="Bodega"
                    subtitle="Uniformes guardados a tu nombre."
                    headline={`${fmtNum(stockSummary.totalOnHand)} pieza${stockSummary.totalOnHand === 1 ? '' : 's'}`}
                    empty={stockRows.length === 0 ? 'Aún no tenés uniformes en bodega.' : null}
                    rows={[
                        {
                            label: 'Disponibles',
                            value: fmtNum(stockSummary.totalAvailable)
                        },
                        {
                            label: 'Productos',
                            value: fmtNum(stockSummary.byProduct.size),
                            sub: `${stockSummary.skuCount} talla${stockSummary.skuCount === 1 ? '' : 's'}`
                        },
                        {
                            label: 'Valor estimado',
                            value: fmtCRC(stockSummary.estimatedValue)
                        }
                    ]}
                />

                <SummaryCard
                    href="/cuentas"
                    Icon={Receipt}
                    accent={invoiceSummary.overdue > 0 ? 'red' : 'emerald'}
                    title="Cuentas"
                    subtitle={
                        invoiceSummary.overdue > 0
                            ? 'Tenés pagos vencidos.'
                            : 'Estado de cuenta al día.'
                    }
                    headline={fmtCRC(invoiceSummary.totalBalance)}
                    headlineSub="por cobrar"
                    empty={invoices.length === 0 ? 'Todavía no hay facturas emitidas.' : null}
                    rows={[
                        {
                            label: 'Vencido',
                            value: fmtCRC(invoiceSummary.overdueBalance),
                            sub: `${invoiceSummary.overdue} factura${invoiceSummary.overdue === 1 ? '' : 's'}`,
                            tone: invoiceSummary.overdue > 0 ? 'red' : undefined
                        },
                        {
                            label: 'Facturas abiertas',
                            value: fmtNum(openInvoices)
                        },
                        {
                            label: 'Próximo vencimiento',
                            value: invoiceSummary.nextDueDate || '—'
                        }
                    ]}
                />
            </section>

            {/* ── Entregados (collapsed) ───────────────────────────── */}
            {completed.length > 0 && (
                <section>
                    <div className="flex items-end justify-between gap-3 mb-3">
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                Pedidos entregados
                            </h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Los últimos {Math.min(completed.length, 4)} entregados.
                            </p>
                        </div>
                        <Link
                            href="/orders"
                            className="text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-semibold inline-flex items-center gap-1 shrink-0"
                        >
                            Ver historial <ArrowRight size={14} />
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

const ACCENT_RING = {
    orange: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
} as const;

function SummaryCard({
    href,
    Icon,
    accent,
    title,
    subtitle,
    headline,
    headlineSub,
    rows,
    empty
}: {
    href: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    accent: keyof typeof ACCENT_RING;
    title: string;
    subtitle: string;
    headline: string;
    headlineSub?: string;
    rows: { label: string; value: string; sub?: string; tone?: 'red' }[];
    empty: string | null;
}) {
    return (
        <Link
            href={href}
            className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
            <div className="flex items-center gap-3">
                <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ACCENT_RING[accent]}`}
                >
                    <Icon size={17} />
                </div>
                <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{title}</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{subtitle}</p>
                </div>
                <ArrowRight
                    size={16}
                    className="text-zinc-300 dark:text-zinc-600 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0"
                />
            </div>

            {empty ? (
                <p className="mt-5 text-sm text-zinc-400 dark:text-zinc-500 italic">{empty}</p>
            ) : (
                <>
                    <p className="font-display text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 leading-none mt-5">
                        {headline}
                    </p>
                    {headlineSub && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {headlineSub}
                        </p>
                    )}
                    <div className="mt-3">
                        {rows.map((r) => (
                            <div
                                key={r.label}
                                className="flex items-start justify-between gap-3 py-2 border-t border-zinc-100 dark:border-zinc-800"
                            >
                                <span className="text-xs text-zinc-500 dark:text-zinc-400 pt-0.5">
                                    {r.label}
                                </span>
                                <span className="text-right min-w-0">
                                    <span
                                        className={`block text-sm font-bold truncate ${
                                            r.tone === 'red'
                                                ? 'text-red-600 dark:text-red-400'
                                                : 'text-zinc-900 dark:text-zinc-100'
                                        }`}
                                    >
                                        {r.value}
                                    </span>
                                    {r.sub && (
                                        <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                                            {r.sub}
                                        </span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </Link>
    );
}

function Column({
    title,
    subtitle,
    Icon,
    accent,
    orders,
    progressByOrder,
    withdrawable,
    empty
}: {
    title: string;
    subtitle: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    accent: 'orange' | 'emerald';
    orders: Order[];
    progressByOrder: Map<string, CustomerOrderProgress>;
    withdrawable: Map<string, number>;
    empty: React.ReactNode;
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
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 px-3 py-8 text-center">
                        {empty}
                    </p>
                ) : (
                    orders.map((o) => {
                        const p = o.uuid ? progressByOrder.get(o.uuid) : undefined;
                        return p ? (
                            <OrderCard
                                key={o.uuid || o.id}
                                order={o}
                                progress={p}
                                withdrawablePieces={o.uuid ? withdrawable.get(o.uuid) : 0}
                            />
                        ) : null;
                    })
                )}
            </div>
        </div>
    );
}
