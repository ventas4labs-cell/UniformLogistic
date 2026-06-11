import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { fetchOrdersOutsourcedToStage } from '@/lib/services/station-assignments';
import { orderNeedsStage } from '@/lib/stage-utils';
import { SimpleStageBoard } from '@/components/admin/simple-stage-board';

export default async function PloterPage() {
    const supabase = await createClient();
    const [all, completed] = await Promise.all([
        fetchAllOrders(supabase),
        fetchStageCompletions(supabase, 'ploter')
    ]);
    const ploterOrders = all.filter(
        (o) => o.status !== 'cancelled' && orderNeedsStage(o, 'ploter')
    );
    // Orders sent to an external ploter station are produced there, so
    // hide them from this in-house board to avoid double production.
    const outsourced = await fetchOrdersOutsourcedToStage(
        supabase,
        ploterOrders.map((o) => o.uuid).filter((id): id is string => !!id),
        'ploter'
    );
    const orders = ploterOrders.filter(
        (o) => !(o.uuid && outsourced.has(o.uuid))
    );
    return (
        <SimpleStageBoard
            initialOrders={orders}
            initialCompletedOrderIds={Array.from(completed)}
            stage="ploter"
        />
    );
}
