import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { fetchCompletionsForOrders } from '@/lib/services/insumo-completions';
import { fetchOrdersOutsourcedToStage } from '@/lib/services/station-assignments';
import { orderNeedsStage } from '@/lib/stage-utils';
import { MaquilaBoard } from '@/components/admin/maquila-board';

export default async function MaquilaPage() {
    const supabase = await createClient();
    const all = await fetchAllOrders(supabase);
    const maquilaOrders = all.filter(
        (o) => o.status !== 'cancelled' && orderNeedsStage(o, 'maquila')
    );
    const orderIds = maquilaOrders
        .map((o) => o.uuid)
        .filter((id): id is string => !!id);
    const [completed, insumoCompletions, outsourced] = await Promise.all([
        fetchStageCompletions(supabase, 'maquila'),
        fetchCompletionsForOrders(supabase, orderIds),
        fetchOrdersOutsourcedToStage(supabase, orderIds, 'maquila')
    ]);
    // Orders sent to an external maquila workshop are produced there, so
    // hide them from this in-house board to avoid double production.
    const orders = maquilaOrders.filter(
        (o) => !(o.uuid && outsourced.has(o.uuid))
    );
    return (
        <MaquilaBoard
            initialOrders={orders}
            initialCompletedOrderIds={Array.from(completed)}
            initialInsumoCompletions={insumoCompletions}
        />
    );
}
