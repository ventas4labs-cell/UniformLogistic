import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { fetchLogos } from '@/lib/services/logos';
import { fetchOrdersOutsourcedToStage } from '@/lib/services/station-assignments';
import { orderNeedsStage } from '@/lib/stage-utils';
import { SimpleStageBoard } from '@/components/admin/simple-stage-board';

export default async function BordadoPage() {
    const supabase = await createClient();
    const [all, completed, logos] = await Promise.all([
        fetchAllOrders(supabase),
        fetchStageCompletions(supabase, 'bordado'),
        fetchLogos(supabase)
    ]);
    const bordadoOrders = all.filter(
        (o) => o.status !== 'cancelled' && orderNeedsStage(o, 'bordado')
    );
    // Orders sent to an external bordado workshop are produced there, so
    // hide them from this in-house board to avoid double production.
    const outsourced = await fetchOrdersOutsourcedToStage(
        supabase,
        bordadoOrders.map((o) => o.uuid).filter((id): id is string => !!id),
        'bordado'
    );
    const orders = bordadoOrders.filter(
        (o) => !(o.uuid && outsourced.has(o.uuid))
    );
    return (
        <SimpleStageBoard
            initialOrders={orders}
            initialCompletedOrderIds={Array.from(completed)}
            stage="bordado"
            logos={logos}
        />
    );
}
