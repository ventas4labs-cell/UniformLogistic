import type { CustomerAnalytics } from '@/lib/customer-analytics';

const fmtCRC = (n: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n);

const fmtNum = (n: number) => n.toLocaleString('es-CR');

// The dashboard's one lead block: what this company has spent, beside how
// that spending arrived month by month. Kept as a single panel rather
// than a row of identical stat cards — the numbers only mean something
// next to the shape of the year.

export function SpendPanel({ stats }: { stats: CustomerAnalytics }) {
    const { months } = stats;
    const maxSpend = Math.max(0, ...months.map((m) => m.spend));
    const maxOrders = Math.max(0, ...months.map((m) => m.orders));
    const hasSpend = maxSpend > 0;
    const windowOrders = months.reduce((s, m) => s + m.orders, 0);

    // Any activity gets a visible sliver, so a small month never reads as
    // a month where nothing happened.
    const pct = (v: number, max: number) => (v <= 0 ? 0 : Math.max(4, (v / max) * 100));

    const clientSince = stats.firstOrderDate
        ? new Date(stats.firstOrderDate).toLocaleDateString('es-CR', {
              month: 'long',
              year: 'numeric'
          })
        : '—';

    return (
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,17rem)_1fr]">
                {/* ── Totals ───────────────────────────────────────── */}
                <div className="p-5 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        Total facturado
                    </h2>
                    <p className="font-display text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 leading-none mt-1">
                        {fmtCRC(stats.totalInvoiced)}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
                        {fmtCRC(stats.spendThisYear)} este año ·{' '}
                        {fmtCRC(stats.totalPaid)} pagado
                    </p>

                    <div className="mt-4">
                        <Row
                            label="Pedidos realizados"
                            value={fmtNum(stats.totalOrders)}
                            sub={`${stats.ordersThisYear} este año`}
                        />
                        <Row
                            label="Piezas pedidas"
                            value={fmtNum(stats.totalPieces)}
                            sub={`${fmtNum(stats.piecesThisYear)} este año`}
                        />
                        <Row
                            label="Factura promedio"
                            value={fmtCRC(stats.avgInvoice)}
                            sub={`${stats.invoiceCount} factura${stats.invoiceCount === 1 ? '' : 's'}`}
                        />
                        <Row
                            label="Piezas por pedido"
                            value={fmtNum(stats.avgPiecesPerOrder)}
                            sub="promedio"
                        />
                        <Row label="Cliente desde" value={clientSince} />
                    </div>
                </div>

                {/* ── Twelve months ────────────────────────────────── */}
                <div className="p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
                        <h2 className="font-bold text-zinc-900 dark:text-zinc-100">
                            Gasto por mes
                        </h2>
                        <div className="flex items-center gap-4 text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
                                Facturado
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-zinc-300 dark:bg-zinc-600" />
                                Pedidos
                            </span>
                        </div>
                    </div>

                    {!hasSpend && (
                        <p className="mb-4 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl px-3 py-2.5">
                            Todavía no hay facturas emitidas. El historial de gasto aparecerá aquí
                            en cuanto se facture tu primer pedido.
                        </p>
                    )}

                    <div className="flex items-stretch gap-1 sm:gap-1.5">
                        {months.map((m) => (
                            <div
                                key={m.key}
                                className="flex-1 min-w-0 flex flex-col gap-1 group"
                                title={`${m.longLabel} · ${fmtCRC(m.spend)} · ${m.orders} pedido${
                                    m.orders === 1 ? '' : 's'
                                } · ${m.pieces} pieza${m.pieces === 1 ? '' : 's'}`}
                            >
                                <div className="h-28 sm:h-32 flex items-end">
                                    <div
                                        className="w-full rounded-t-md bg-orange-500 group-hover:bg-orange-600 transition-colors motion-reduce:transition-none"
                                        style={{
                                            height: `${hasSpend ? pct(m.spend, maxSpend) : 0}%`
                                        }}
                                    />
                                </div>
                                <div className="h-7 flex items-end border-t border-zinc-100 dark:border-zinc-800 pt-1">
                                    <div
                                        className="w-full rounded-t-sm bg-zinc-300 dark:bg-zinc-600"
                                        style={{
                                            height: `${maxOrders > 0 ? pct(m.orders, maxOrders) : 0}%`
                                        }}
                                    />
                                </div>
                                <div className="text-[10px] text-center text-zinc-500 dark:text-zinc-400 truncate">
                                    {m.label}
                                </div>
                            </div>
                        ))}
                    </div>

                    <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                        {fmtCRC(stats.spendInWindow)} facturado y {windowOrders} pedido
                        {windowOrders === 1 ? '' : 's'} en los últimos {months.length} meses.
                    </p>
                </div>
            </div>
        </section>
    );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="flex items-start justify-between gap-3 py-2.5 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 pt-0.5">{label}</span>
            <span className="text-right min-w-0">
                <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {value}
                </span>
                {sub && (
                    <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                        {sub}
                    </span>
                )}
            </span>
        </div>
    );
}
