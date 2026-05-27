import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchCompletionsForOrders } from '@/lib/services/insumo-completions';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { fetchPreparationsForOrders } from '@/lib/services/insumo-preparations';
import { OperatorBoard } from '@/components/admin/operator-board';

export default async function OperadorPage() {
    const supabase = await createClient();
    const orders = await fetchAllOrders(supabase);
    const orderIds = orders.map((o) => o.uuid).filter((id): id is string => !!id);
    const [insumoCompletions, bodegaCompleted, preparations] = await Promise.all([
        fetchCompletionsForOrders(supabase, orderIds),
        fetchStageCompletions(supabase, 'bodega'),
        fetchPreparationsForOrders(supabase, orderIds)
    ]);
    // Bodega historically showed everything anyway; we now also pass
    // the per-stage completion set so each card can render the
    // "Bodega completado" toggle and the Pendientes/Completados tabs.
    return (
        <OperatorBoard
            initialOrders={orders.filter((o) => o.status !== 'cancelled')}
            initialCompletions={insumoCompletions}
            initialBodegaCompletedOrderIds={Array.from(bodegaCompleted)}
            initialPreparations={preparations}
        />
    );
}
