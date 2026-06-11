import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchCompletionsForOrders } from '@/lib/services/insumo-completions';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { fetchPreparationsForOrders } from '@/lib/services/insumo-preparations';
import { fetchAssignmentsForOrders } from '@/lib/services/station-assignments';
import { orderNeedsStage } from '@/lib/stage-utils';
import { OperatorBoard } from '@/components/admin/operator-board';

export default async function OperadorPage() {
    const supabase = await createClient();
    const orders = await fetchAllOrders(supabase);
    const orderIds = orders.map((o) => o.uuid).filter((id): id is string => !!id);
    const [insumoCompletions, bodegaCompleted, preparations, assignments] =
        await Promise.all([
            fetchCompletionsForOrders(supabase, orderIds),
            fetchStageCompletions(supabase, 'bodega'),
            fetchPreparationsForOrders(supabase, orderIds),
            fetchAssignmentsForOrders(supabase, orderIds)
        ]);

    // Flatten station assignments into orderId → [station name, …] so
    // the Bodega PDF export can name the workshop(s) the order goes to.
    const stationNamesByOrder: Record<string, string[]> = {};
    for (const a of assignments) {
        const name = a.stationUserName || a.stationUserEmail || 'Estación';
        (stationNamesByOrder[a.orderId] ||= []).push(name);
    }

    // Orders sent to an external bodega station are prepared there, so
    // hide them from this in-house board to avoid double production.
    const outsourcedBodega = new Set(
        assignments
            .filter((a) => a.stationUserStage === 'bodega')
            .map((a) => a.orderId)
    );

    return (
        <OperatorBoard
            initialOrders={orders.filter(
                (o) =>
                    o.status !== 'cancelled' &&
                    orderNeedsStage(o, 'bodega') &&
                    !(o.uuid && outsourcedBodega.has(o.uuid))
            )}
            initialCompletions={insumoCompletions}
            initialBodegaCompletedOrderIds={Array.from(bodegaCompleted)}
            initialPreparations={preparations}
            stationNamesByOrder={stationNamesByOrder}
        />
    );
}
