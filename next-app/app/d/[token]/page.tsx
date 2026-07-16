// ─── Driver delivery-plan link ──────────────────────────────────────
// Public, tokenized, mobile-first page the admin shares with the
// courier. Opening /d/<token> on a phone shows the day's scheduled
// (not-yet-delivered) deliveries, grouped by date. Read-only review —
// reads run with the service-role client so the driver needs no login.

import { createServiceClient } from '@/utils/supabase/server';
import {
    isValidDriverToken,
    fetchDeliveryPlan,
    type DriverPlanOrder
} from '@/lib/services/deliveries';
import { Truck, Package, Building2, User } from 'lucide-react';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string): string {
    const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
    return `${d}/${m}/${y}`;
}
function heading(iso: string): string {
    const today = new Date().toISOString().slice(0, 10);
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    if (iso === today) return `Hoy · ${fmtDate(iso)}`;
    if (iso === tmr.toISOString().slice(0, 10)) return `Mañana · ${fmtDate(iso)}`;
    return fmtDate(iso);
}

export default async function DriverPlanPage({
    params
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const service = createServiceClient();

    const valid = await isValidDriverToken(service, token);
    if (!valid) {
        return (
            <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8 text-center">
                <Truck size={40} className="text-zinc-600 mb-4" />
                <h1 className="text-lg font-bold">Link inválido</h1>
                <p className="text-sm text-zinc-400 mt-1">
                    Pedile a la oficina un link nuevo.
                </p>
            </main>
        );
    }

    const plan = await fetchDeliveryPlan(service);

    // Group by scheduled date (already ordered ascending).
    const groups = new Map<string, DriverPlanOrder[]>();
    for (const o of plan) {
        const arr = groups.get(o.scheduledDate);
        if (arr) arr.push(o);
        else groups.set(o.scheduledDate, [o]);
    }

    return (
        <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
            <header className="sticky top-0 z-10 bg-orange-600 text-white px-4 py-3 shadow-md">
                <div className="flex items-center gap-2">
                    <Truck size={20} />
                    <div>
                        <h1 className="font-extrabold leading-tight">Plan de entregas</h1>
                        <p className="text-[11px] text-orange-100">
                            {plan.length} pedido{plan.length === 1 ? '' : 's'} por entregar
                        </p>
                    </div>
                </div>
            </header>

            <div className="p-4 space-y-6 max-w-lg mx-auto">
                {plan.length === 0 ? (
                    <div className="text-center text-zinc-500 dark:text-zinc-400 py-16">
                        <Package size={36} className="mx-auto mb-3 opacity-40" />
                        <p className="font-semibold">No hay entregas programadas.</p>
                    </div>
                ) : (
                    Array.from(groups.entries()).map(([date, orders]) => (
                        <section key={date}>
                            <h2 className="text-sm font-extrabold uppercase tracking-wide text-orange-700 dark:text-orange-400 mb-2">
                                {heading(date)}
                                <span className="ml-2 text-zinc-500 dark:text-zinc-400 font-bold normal-case">
                                    {orders.length} pedido{orders.length === 1 ? '' : 's'}
                                </span>
                            </h2>
                            <div className="space-y-3">
                                {orders.map((o) => (
                                    <article
                                        key={o.orderRef}
                                        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                                                {o.orderRef}
                                            </span>
                                            <span className="bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-xs font-extrabold px-2.5 py-1 rounded-full">
                                                {o.totalPieces} pzas
                                            </span>
                                        </div>
                                        <p className="mt-1.5 font-bold text-lg leading-tight flex items-center gap-1.5">
                                            <Building2 size={16} className="text-zinc-400 shrink-0" />
                                            {o.companyName || '—'}
                                        </p>
                                        {o.contactName && (
                                            <p className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                                                <User size={13} /> {o.contactName}
                                            </p>
                                        )}
                                        {o.items.length > 0 && (
                                            <ul className="mt-3 space-y-1 border-t border-zinc-100 dark:border-zinc-800 pt-2">
                                                {o.items.map((it, i) => (
                                                    <li
                                                        key={i}
                                                        className="flex items-center justify-between text-sm"
                                                    >
                                                        <span className="text-zinc-700 dark:text-zinc-300">
                                                            {it.name}
                                                            {it.size ? (
                                                                <span className="text-zinc-400 dark:text-zinc-500">
                                                                    {' '}· {it.size}
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                        <span className="font-mono font-bold text-zinc-700 dark:text-zinc-200 shrink-0 ml-2">
                                                            ×{it.quantity}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </article>
                                ))}
                            </div>
                        </section>
                    ))
                )}
            </div>
        </main>
    );
}
