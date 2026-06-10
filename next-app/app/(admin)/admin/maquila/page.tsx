import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { fetchCompletionsForOrders } from '@/lib/services/insumo-completions';
import { orderNeedsStage } from '@/lib/stage-utils';
import { MaquilaBoard } from '@/components/admin/maquila-board';

export default async function MaquilaPage() {
    const supabase = await createClient();
    const all = await fetchAllOrders(supabase);
    const orders = all.filter(
        (o) => o.status !== 'cancelled' && orderNeedsStage(o, 'maquila')
    );
    const orderIds = orders.map((o) => o.uuid).filter((id): id is string => !!id);
    const [completed, insumoCompletions] = await Promise.all([
        fetchStageCompletions(supabase, 'maquila'),
        fetchCompletionsForOrders(supabase, orderIds)
    ]);
    return (
        <MaquilaBoard
            initialOrders={orders}
            initialCompletedOrderIds={Array.from(completed)}
            initialInsumoCompletions={insumoCompletions}
        />
    );
}
