import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchProducts } from '@/lib/services/products';
import { fetchAllReports } from '@/lib/services/missing-insumos';
import { fetchAllStageNotifications } from '@/lib/services/stage-notifications';
import { OrdersTable } from '@/components/admin/orders-table';

export default async function AdminOrdersPage() {
    const supabase = await createClient();
    const [orders, products, reports, stageNotifications] = await Promise.all([
        fetchAllOrders(supabase),
        fetchProducts(supabase),
        fetchAllReports(supabase),
        fetchAllStageNotifications(supabase)
    ]);
    return (
        <OrdersTable
            initialOrders={orders}
            products={products}
            reports={reports}
            stageNotifications={stageNotifications}
        />
    );
}
