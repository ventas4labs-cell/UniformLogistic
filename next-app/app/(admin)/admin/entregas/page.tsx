import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchDispatchTotalsForOrders } from '@/lib/services/dispatches';
import { fetchStockEntryTotalsForOrders } from '@/lib/services/stock-entries';
import { fetchDeliveriesForOrders, fetchDriverLinkToken } from '@/lib/services/deliveries';
import { DeliveryBoard, type DeliverySummary } from '@/components/admin/delivery-board';
import type { Order } from '@/lib/types';

// An order is deliverable once every line is fully accounted for across
// BOTH channels — pieces sent to the customer's stock never get a delivery
// row, so requiring full delivery coverage stranded every split order:
// it left the Empaque board (which completes on combined coverage) and
// could never appear here. It still needs at least one piece actually
// going out, so all-to-stock orders stay off the courier board.
function readyForDelivery(
    order: Order,
    dispatched: Map<string, number> | undefined,
    stocked: Map<string, number> | undefined
): boolean {
    if (order.items.length === 0) return false;
    let deliveryPieces = 0;
    for (const it of order.items) {
        if (!it.uuid) return false;
        const out = (dispatched?.get(it.uuid) || 0) + (stocked?.get(it.uuid) || 0);
        if (out < it.quantity) return false;
        deliveryPieces += Math.min(dispatched?.get(it.uuid) || 0, it.quantity);
    }
    return deliveryPieces > 0;
}

/** Pieces actually going to the courier — never the ordered quantity, which
 *  would hand the driver the stock-routed pieces too. */
function deliveryPieceCount(
    order: Order,
    dispatched: Map<string, number> | undefined
): number {
    return order.items.reduce(
        (s, i) => s + (i.uuid ? Math.min(dispatched?.get(i.uuid) || 0, i.quantity) : 0),
        0
    );
}

export default async function EntregasPage() {
    const supabase = await createClient();
    const orders = await fetchAllOrders(supabase);
    const orderIds = orders.map((o) => o.uuid).filter((id): id is string => !!id);
    const [dispatchTotals, stockTotals, deliveries, driverToken] = await Promise.all([
        fetchDispatchTotalsForOrders(supabase, orderIds),
        fetchStockEntryTotalsForOrders(supabase, orderIds),
        fetchDeliveriesForOrders(supabase, orderIds),
        fetchDriverLinkToken(supabase)
    ]);

    const summaries: DeliverySummary[] = orders
        .filter(
            (o) =>
                o.uuid &&
                o.status !== 'cancelled' &&
                readyForDelivery(o, dispatchTotals.get(o.uuid), stockTotals.get(o.uuid))
        )
        .map((o) => {
            const d = deliveries.get(o.uuid as string) || null;
            const dispatched = dispatchTotals.get(o.uuid as string);
            return {
                uuid: o.uuid as string,
                ref: o.id,
                companyName: o.companyName,
                contactName: o.customerName || '',
                requestedDeliveryDate: o.deliveryDate || '',
                totalPieces: deliveryPieceCount(o, dispatched),
                items: [
                    ...new Set(
                        o.items
                            .filter((i) => i.uuid && (dispatched?.get(i.uuid) || 0) > 0)
                            .map((i) => i.productName)
                            .filter(Boolean)
                    )
                ],
                scheduledDate: d?.scheduledDate || null,
                notifiedAt: d?.notifiedAt || null,
                deliveredAt: d?.deliveredAt || null
            };
        });

    return (
        <DeliveryBoard initialSummaries={summaries} initialDriverToken={driverToken} />
    );
}
