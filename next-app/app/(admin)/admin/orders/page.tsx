import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchProducts } from '@/lib/services/products';
import { fetchAllReports } from '@/lib/services/missing-insumos';
import { fetchAllStageNotifications } from '@/lib/services/stage-notifications';
import { fetchStageCompletionsForOrders } from '@/lib/services/stage-completions';
import { OrdersTable } from '@/components/admin/orders-table';

export default async function AdminOrdersPage() {
    const supabase = await createClient();
    const [orders, products, reports, stageNotifications] = await Promise.all([
        fetchAllOrders(supabase),
        fetchProducts(supabase),
        fetchAllReports(supabase),
        fetchAllStageNotifications(supabase)
    ]);
    // Per-order stage completions for the new "Bodega · Corte · Maquila ·
    // Impresión" strip in each card. Done as a second-stage fetch so the
    // first three queries above can run in parallel without waiting on
    // the order-ids list.
    const orderIds = orders.map((o) => o.uuid).filter((id): id is string => !!id);
    const completions = await fetchStageCompletionsForOrders(supabase, orderIds);
    // Serialize the Map for the client component (Sets/Maps don't pass
    // through Server-Component → Client-Component prop boundaries).
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
        />
    );
}
