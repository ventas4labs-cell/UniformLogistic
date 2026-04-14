import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { OrdersTable } from '@/components/admin/orders-table';

export default async function AdminOrdersPage() {
    const supabase = await createClient();
    const orders = await fetchAllOrders(supabase);
    return <OrdersTable initialOrders={orders} />;
}
