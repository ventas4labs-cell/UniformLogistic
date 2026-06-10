import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { orderNeedsStage } from '@/lib/stage-utils';
import { CorteBoard } from '@/components/admin/corte-board';

export default async function CortePage() {
    const supabase = await createClient();
    const [all, completed] = await Promise.all([
        fetchAllOrders(supabase),
        fetchStageCompletions(supabase, 'corte')
    ]);
    // Workflow is parallel: every non-cancelled order shows up on every
    // board immediately. Corte marks its own work complete via the
    // per-stage completion toggle (independent of orders.status).
    const orders = all.filter(
        (o) => o.status !== 'cancelled' && orderNeedsStage(o, 'corte')
    );
    return (
        <CorteBoard
            initialOrders={orders}
            initialCompletedOrderIds={Array.from(completed)}
        />
    );
}
