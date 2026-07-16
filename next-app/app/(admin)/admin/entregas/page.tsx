import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchDispatchTotalsForOrders } from '@/lib/services/dispatches';
import { fetchDeliveriesForOrders, fetchDriverLinkToken } from '@/lib/services/deliveries';
import { DeliveryBoard, type DeliverySummary } from '@/components/admin/delivery-board';
import type { Order } from '@/lib/types';

// An order is deliverable once every line has been fully dispatched from
// Empaque (all pieces shipped). Those are the orders the courier works.
function fullyDispatched(
    order: Order,
    totals: Map<string, number> | undefined
): boolean {
    if (!totals || order.items.length === 0) return false;
    let anyQty = false;
    for (const it of order.items) {
        if (!it.uuid) return false;
        if ((totals.get(it.uuid) || 0) < it.quantity) return false;
        if (it.quantity > 0) anyQty = true;
    }
    return anyQty;
}

export default async function EntregasPage() {
    const supabase = await createClient();
    const orders = await fetchAllOrders(supabase);
    const orderIds = orders.map((o) => o.uuid).filter((id): id is string => !!id);
    const [dispatchTotals, deliveries, driverToken] = await Promise.all([
        fetchDispatchTotalsForOrders(supabase, orderIds),
        fetchDeliveriesForOrders(supabase, orderIds),
        fetchDriverLinkToken(supabase)
    ]);

    const summaries: DeliverySummary[] = orders
        .filter(
            (o) =>
                o.uuid &&
                o.status !== 'cancelled' &&
                fullyDispatched(o, dispatchTotals.get(o.uuid))
        )
        .map((o) => {
            const d = deliveries.get(o.uuid as string) || null;
            return {
                uuid: o.uuid as string,
                ref: o.id,
                companyName: o.companyName,
                contactName: o.customerName || '',
                requestedDeliveryDate: o.deliveryDate || '',
                totalPieces: o.items.reduce((s, i) => s + i.quantity, 0),
                items: [...new Set(o.items.map((i) => i.productName).filter(Boolean))],
                scheduledDate: d?.scheduledDate || null,
                notifiedAt: d?.notifiedAt || null,
                deliveredAt: d?.deliveredAt || null
            };
        });

    return (
        <DeliveryBoard initialSummaries={summaries} initialDriverToken={driverToken} />
    );
}
