import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchProducts } from '@/lib/services/products';
import { fetchAllReports } from '@/lib/services/missing-insumos';
import { fetchAllStageNotifications } from '@/lib/services/stage-notifications';
import { fetchStageCompletionsForOrders } from '@/lib/services/stage-completions';
import { fetchStationUsers } from '@/lib/services/station-users';
import { fetchAssignmentsForOrders } from '@/lib/services/station-assignments';
import { fetchDeletedOrders } from '@/lib/services/deleted-orders';
import { OrdersTable } from '@/components/admin/orders-table';

export default async function AdminOrdersPage() {
    const supabase = await createClient();
    const [orders, products, reports, stageNotifications, stationUsers, deletedOrders] =
        await Promise.all([
            fetchAllOrders(supabase),
            fetchProducts(supabase),
            fetchAllReports(supabase),
            fetchAllStageNotifications(supabase),
            fetchStationUsers(supabase),
            fetchDeletedOrders(supabase)
        ]);
    const orderIds = orders.map((o) => o.uuid).filter((id): id is string => !!id);
    const [completions, assignments] = await Promise.all([
        fetchStageCompletionsForOrders(supabase, orderIds),
        fetchAssignmentsForOrders(supabase, orderIds)
    ]);
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
        />
    );
}
