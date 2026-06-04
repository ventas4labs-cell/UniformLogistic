import Link from 'next/link';
import {
    ArrowRight,
    Building2,
    ClipboardList,
    Factory,
    Package,
    Receipt,
    ShieldCheck,
    Sticker,
    XCircle
} from 'lucide-react';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import {
    fetchStageCompletionsForOrders,
    STAGE_ORDER,
    STAGE_LABELS
} from '@/lib/services/stage-completions';
import { fetchCompanies } from '@/lib/services/companies';
import { fetchProducts } from '@/lib/services/products';
import { fetchLogos } from '@/lib/services/logos';
import { fetchAllStationInvoices } from '@/lib/services/station-invoices';
import { FAST_ACTIONS_COOKIE, resolveFastActions } from '@/lib/admin-fast-actions';
import { QuickActionsPanel } from '@/components/admin/quick-actions-panel';

// Admin panel home — quick actions + at-a-glance statistics. Replaces
// the old behavior where /admin redirected straight to /admin/orders
// and the admin shared the customer /home dashboard.

export default async function AdminHomePage() {
    const supabase = await createClient();

    const [orders, companies, products, logos, stationInvoices] = await Promise.all([
        fetchAllOrders(supabase),
        fetchCompanies(supabase),
        fetchProducts(supabase),
        fetchLogos(supabase),
        fetchAllStationInvoices(supabase)
    ]);

    const cookieStore = await cookies();
    const fastActions = resolveFastActions(
        cookieStore.get(FAST_ACTIONS_COOKIE)?.value
    );

    const orderIds = orders
        .map((o) => o.uuid)
        .filter((id): id is string => Boolean(id));
    const completions = await fetchStageCompletionsForOrders(supabase, orderIds);

    const totalStages = STAGE_ORDER.length;
    const active = orders.filter((o) => o.status !== 'cancelled');
    const cancelled = orders.filter((o) => o.status === 'cancelled');

    const stagesDone = (uuid: string | undefined): number =>
        uuid ? completions.get(uuid)?.size || 0 : 0;

    const completed = active.filter((o) => stagesDone(o.uuid) >= totalStages);
    const inProduction = active.filter((o) => stagesDone(o.uuid) < totalStages);

    const piecesInProduction = inProduction.reduce(
        (s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0),
        0
    );

    // Per-stage pending: active orders whose completion set lacks the stage.
    const stagePending = STAGE_ORDER.map((stage) => {
        const pending = active.filter((o) => {
            const perOrder = o.uuid ? completions.get(o.uuid) : undefined;
            return !perOrder?.has(stage);
        }).length;
        return { stage, label: STAGE_LABELS[stage], pending };
    });

    const invoicesToPay = stationInvoices.filter((i) => i.status === 'pending').length;

    return (
        <div className="space-y-8">
            {/* ── Header ───────────────────────────────────────────── */}
            <header>
                <p className="text-xs uppercase tracking-widest font-semibold text-orange-600 dark:text-orange-400">
                    Panel de administración
                </p>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-zinc-100 mt-1">
                    Inicio
                </h1>
                <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">
                    {active.length} pedido{active.length === 1 ? '' : 's'} activo
                    {active.length === 1 ? '' : 's'} · {piecesInProduction} pieza
                    {piecesInProduction === 1 ? '' : 's'} en producción
                </p>
            </header>

            {/* ── Quick actions (configurable top-bar pins) ────────── */}
            <QuickActionsPanel
                initialPinned={fastActions}
                badges={{ invoicesToPay }}
            />

            {/* ── Order KPIs ───────────────────────────────────────── */}
            <section>
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-3">
                    Pedidos
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard
                        label="En producción"
                        value={inProduction.length}
                        sub={`${piecesInProduction} piezas`}
                        Icon={Factory}
                        accent="orange"
                        href="/admin/orders"
                    />
                    <StatCard
                        label="Completados"
                        value={completed.length}
                        sub="todas las etapas"
                        Icon={ShieldCheck}
                        accent="emerald"
                        href="/admin/orders"
                    />
                    <StatCard
                        label="Cancelados"
                        value={cancelled.length}
                        sub="histórico"
                        Icon={XCircle}
                        accent="zinc"
                        href="/admin/orders"
                    />
                    <StatCard
                        label="Total de pedidos"
                        value={orders.length}
                        sub="todos"
                        Icon={ClipboardList}
                        accent="zinc"
                        href="/admin/orders"
                    />
                </div>
            </section>

            {/* ── Per-stage workload ───────────────────────────────── */}
            <section>
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-3">
                    Pendientes por etapa
                </h2>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                        {stagePending.map(({ stage, label, pending }) => (
                            <Link
                                key={stage}
                                href={
                                    stage === 'bodega'
                                        ? '/admin/operador'
                                        : `/admin/${stage}`
                                }
                                className="rounded-xl bg-gray-50 dark:bg-zinc-800/50 hover:bg-orange-50 dark:hover:bg-orange-950/30 p-3 text-center transition-colors"
                            >
                                <div
                                    className={`text-2xl font-extrabold leading-none ${
                                        pending === 0
                                            ? 'text-green-600 dark:text-green-400'
                                            : 'text-orange-600 dark:text-orange-400'
                                    }`}
                                >
                                    {pending}
                                </div>
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mt-1 truncate">
                                    {label}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Catalog stats ────────────────────────────────────── */}
            <section>
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-3">
                    Catálogo
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard
                        label="Empresas"
                        value={companies.length}
                        sub="clientes"
                        Icon={Building2}
                        accent="zinc"
                        href="/admin/companies"
                    />
                    <StatCard
                        label="Productos"
                        value={products.length}
                        sub="en catálogo maestro"
                        Icon={Package}
                        accent="zinc"
                        href="/admin/products"
                    />
                    <StatCard
                        label="Logos"
                        value={logos.length}
                        sub="bordado / impresión"
                        Icon={Sticker}
                        accent="zinc"
                        href="/admin/logos"
                    />
                    <StatCard
                        label="Facturas a pagar"
                        value={invoicesToPay}
                        sub="pendientes de pago"
                        Icon={Receipt}
                        accent={invoicesToPay > 0 ? 'orange' : 'zinc'}
                        href="/admin/station-invoices"
                    />
                </div>
            </section>
        </div>
    );
}

// ── Subcomponents ───────────────────────────────────────────────────────

function StatCard({
    label,
    value,
    sub,
    Icon,
    accent,
    href
}: {
    label: string;
    value: number;
    sub: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    accent: 'orange' | 'emerald' | 'zinc';
    href: string;
}) {
    const ring =
        accent === 'orange'
            ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
            : accent === 'emerald'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
              : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300';
    return (
        <Link
            href={href}
            className="group bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-4 flex items-center gap-3 hover:border-orange-200 dark:hover:border-orange-500/40 hover:shadow-md transition-all"
        >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ring}`}>
                <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500 dark:text-zinc-400 font-medium truncate">
                    {label}
                </div>
                <div className="text-xl font-extrabold text-gray-900 dark:text-zinc-100 leading-none mt-0.5">
                    {value}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-zinc-400">{sub}</div>
            </div>
            <ArrowRight
                size={16}
                className="text-gray-300 dark:text-zinc-600 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0"
            />
        </Link>
    );
}
