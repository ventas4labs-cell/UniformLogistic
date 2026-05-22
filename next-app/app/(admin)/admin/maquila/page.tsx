import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { MaquilaBoard } from '@/components/admin/maquila-board';

export default async function MaquilaPage() {
    const supabase = await createClient();
    const all = await fetchAllOrders(supabase);
    const orders = all.filter((o) => o.status === 'maquila');
    return <MaquilaBoard initialOrders={orders} />;
}
