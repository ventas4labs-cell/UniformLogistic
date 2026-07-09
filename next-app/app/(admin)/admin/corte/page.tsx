import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { fetchStageItemProgress } from '@/lib/services/stage-item-progress';
import { fetchOrdersOutsourcedToStage } from '@/lib/services/station-assignments';
import { orderNeedsStage } from '@/lib/stage-utils';
import { CorteBoard } from '@/components/admin/corte-board';

export default async function CortePage() {
    const supabase = await createClient();
    const [all, completed, progress] = await Promise.all([
        fetchAllOrders(supabase),
        fetchStageCompletions(supabase, 'corte'),
        fetchStageItemProgress(supabase, 'corte')
    ]);
    // Workflow is parallel: every non-cancelled order shows up on every
    // board immediately. Corte marks its own work complete via the
    // per-stage completion toggle (independent of orders.status).
    const corteOrders = all.filter(
        (o) => o.status !== 'cancelled' && orderNeedsStage(o, 'corte')
    );
    // An order handed to an EXTERNAL corte station is produced there, so
    // drop it from this in-house corte board to avoid double production.
    // (Re-appears here if the assignment is removed.)
    const outsourced = await fetchOrdersOutsourcedToStage(
        supabase,
        corteOrders.map((o) => o.uuid).filter((id): id is string => !!id),
        'corte'
    );
    const orders = corteOrders.filter(
        (o) => !(o.uuid && outsourced.has(o.uuid))
    );
    return (
        <CorteBoard
            initialOrders={orders}
            initialCompletedOrderIds={Array.from(completed)}
            initialProgress={progress}
        />
    );
}
