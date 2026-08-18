import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchProducts } from '@/lib/services/products';
import { fetchAllReports } from '@/lib/services/missing-insumos';
import { fetchAllStageNotifications } from '@/lib/services/stage-notifications';
import { fetchStageCompletionsForOrders } from '@/lib/services/stage-completions';
import { fetchStationUsers } from '@/lib/services/station-users';
import { fetchAssignmentsForOrders } from '@/lib/services/station-assignments';
import { fetchDeletedOrders } from '@/lib/services/deleted-orders';
import { fetchDispatchTotalsForOrders } from '@/lib/services/dispatches';
import { fetchStockEntryTotalsForOrders } from '@/lib/services/stock-entries';
import { fetchThreeDModels } from '@/lib/services/three-d-models';
import { fetchCorteFabricReports } from '@/lib/services/corte-fabric-reports';
import { fetchFastOrderRequests } from '@/lib/services/fast-orders';
import { OrdersTable } from '@/components/admin/orders-table';
import type { Order } from '@/lib/types';

// An order is "done" for the completed list once every line is fully
// covered — the pieces that left production, whether to delivery or to
// the customer's stock, sum to the ordered quantity. Combining both
// channels (rather than requiring one to cover alone) is what prevents
// the same piece being double-counted across the two ledgers.
function fullyCovered(
    order: Order,
    dispatchByItem: Map<string, number> | undefined,
    stockByItem: Map<string, number> | undefined
): boolean {
    if (order.items.length === 0) return false;
    let anyQty = false;
    for (const it of order.items) {
        if (!it.uuid) return false;
        const out =
            (dispatchByItem?.get(it.uuid) || 0) + (stockByItem?.get(it.uuid) || 0);
        if (out < it.quantity) return false;
        if (it.quantity > 0) anyQty = true;
    }
    return anyQty;
}

export default async function AdminOrdersPage() {
    const supabase = await createClient();
    const [orders, products, reports, stageNotifications, stationUsers, deletedOrders, threeDModels, fastRequests] =
        await Promise.all([
            fetchAllOrders(supabase),
            fetchProducts(supabase),
            fetchAllReports(supabase),
            fetchAllStageNotifications(supabase),
            fetchStationUsers(supabase),
            fetchDeletedOrders(supabase),
            fetchThreeDModels(supabase),
            fetchFastOrderRequests(supabase)
        ]);
    // Only pending fast-order requests need admin action; converted /
    // rejected ones are done.
    const pendingRequests = fastRequests.filter((r) => r.status === 'pending');
    // Lightweight product-code → 3D model map so the order detail view
    // can surface a 3D preview when an order includes a modeled product.
    const models3d = threeDModels
        .filter((m) => m.productCode && m.modelUrl)
        .map((m) => ({ productCode: m.productCode, modelUrl: m.modelUrl, name: m.name }));
    const orderIds = orders.map((o) => o.uuid).filter((id): id is string => !!id);
    const [completions, assignments, dispatchTotals, stockTotals, fabricReportsByOrder] =
        await Promise.all([
            fetchStageCompletionsForOrders(supabase, orderIds),
            fetchAssignmentsForOrders(supabase, orderIds),
            fetchDispatchTotalsForOrders(supabase, orderIds),
            fetchStockEntryTotalsForOrders(supabase, orderIds),
            fetchCorteFabricReports(supabase, orderIds)
        ]);
    // Orders whose production is finished: everything dispatched, or
    // everything moved into stock. These drop off the active list and
    // into the "Completados" archive.
    type CompletedEntry = { orderId: string; reason: 'dispatched' | 'stock' };
    const completedOrders = orders.flatMap((o): CompletedEntry[] => {
        if (!o.uuid || o.status === 'cancelled') return [];
        const disp = dispatchTotals.get(o.uuid);
        const stk = stockTotals.get(o.uuid);
        if (!fullyCovered(o, disp, stk)) return [];
        // Both channels together cover the order — label it by whichever
        // holds more pieces, for the archive's "despachado/en stock" tag.
        const sumBy = (m: Map<string, number> | undefined) =>
            o.items.reduce((s, it) => s + (it.uuid ? m?.get(it.uuid) || 0 : 0), 0);
        return [
            {
                orderId: o.uuid,
                reason: sumBy(stk) > sumBy(disp) ? 'stock' : 'dispatched'
            }
        ];
    });
    const completionsList = Array.from(completions.entries()).flatMap(
        ([orderId, perStage]) => Array.from(perStage.values()).map((c) => ({
            orderId,
            stage: c.stage,
            completedAt: c.completedAt
        }))
    );
    return (
        <OrdersTable
            initialOrders={orders}
            products={products}
            reports={reports}
            stageNotifications={stageNotifications}
            initialStageCompletions={completionsList}
            stationUsers={stationUsers}
            initialAssignments={assignments}
            deletedOrders={deletedOrders}
            completedOrders={completedOrders}
            models3d={models3d}
            fabricReportsByOrder={fabricReportsByOrder}
            fastRequests={pendingRequests}
        />
    );
}
