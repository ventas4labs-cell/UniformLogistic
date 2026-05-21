import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchCompletionsForOrders } from '@/lib/services/insumo-completions';
import { OperatorBoard } from '@/components/admin/operator-board';

export default async function OperadorPage() {
    const supabase = await createClient();
    const orders = await fetchAllOrders(supabase);
    const orderIds = orders.map((o) => o.uuid).filter((id): id is string => !!id);
    const completions = await fetchCompletionsForOrders(supabase, orderIds);
    return <OperatorBoard initialOrders={orders} initialCompletions={completions} />;
}
