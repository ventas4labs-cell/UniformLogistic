// ─── Driver delivery-plan link ──────────────────────────────────────
// Public, tokenized, mobile-first page the admin shares with the
// courier. Opening /d/<token> on a phone shows the day's scheduled
// deliveries grouped by date; the driver taps to mark each delivered.
// Reads/writes run with the service-role client (no login), gated on the
// shared token. Overdue, still-undelivered orders roll forward onto
// today until they're delivered — nothing is ever silently dropped.

import { createServiceClient } from '@/utils/supabase/server';
import { isValidDriverToken, fetchDeliveryPlan } from '@/lib/services/deliveries';
import { Truck } from 'lucide-react';
import {
    DriverDeliveryList,
    type DriverOrder
} from '@/components/driver-delivery-list';

export const dynamic = 'force-dynamic';

// Today/tomorrow in Costa Rica time (UTC-6), so a delivery late in the
// evening isn't bumped a day early by UTC rollover. `en-CA` formats as
// YYYY-MM-DD.
function crToday(): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Costa_Rica'
    }).format(new Date());
}
function nextDay(iso: string): string {
    const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
    return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
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
            <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 p-8 text-center text-zinc-100">
                <Truck size={40} className="mb-4 text-zinc-600" />
                <h1 className="text-lg font-bold">Link inválido</h1>
                <p className="mt-1 text-sm text-zinc-400">
                    Pedile a la oficina un link nuevo.
                </p>
            </main>
        );
    }

    const plan = await fetchDeliveryPlan(service);
    const today = crToday();
    const tomorrow = nextDay(today);

    // Rollover: an order whose planned day has passed but that hasn't been
    // delivered surfaces under today (keeping its original date for the
    // "Atrasado · programado …" note).
    const orders: DriverOrder[] = plan.map((o) => {
        const overdue = o.scheduledDate < today;
        return {
            orderId: o.orderId,
            orderRef: o.orderRef,
            companyName: o.companyName,
            contactName: o.contactName,
            scheduledDate: o.scheduledDate,
            effectiveDate: overdue ? today : o.scheduledDate,
            overdue,
            totalPieces: o.totalPieces,
            items: o.items
        };
    });

    return (
        <DriverDeliveryList
            token={token}
            initialOrders={orders}
            todayIso={today}
            tomorrowIso={tomorrow}
        />
    );
}
