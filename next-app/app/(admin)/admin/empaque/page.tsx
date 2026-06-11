import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { fetchDispatchTotalsForOrders } from '@/lib/services/dispatches';
import { fetchOrdersOutsourcedToStage } from '@/lib/services/station-assignments';
import { orderNeedsStage } from '@/lib/stage-utils';
import { EmpaqueBoard } from '@/components/admin/empaque-board';

export default async function EmpaquePage() {
    const supabase = await createClient();
    const all = await fetchAllOrders(supabase);
    const empaqueOrders = all.filter(
        (o) => o.status !== 'cancelled' && orderNeedsStage(o, 'empaque')
    );
    const orderIds = empaqueOrders
        .map((o) => o.uuid)
        .filter((id): id is string => !!id);
    const [completed, totals, outsourced] = await Promise.all([
        fetchStageCompletions(supabase, 'empaque'),
        fetchDispatchTotalsForOrders(supabase, orderIds),
        fetchOrdersOutsourcedToStage(supabase, orderIds, 'empaque')
    ]);
    // Orders sent to an external empaque station are handled there, so
    // hide them from this in-house board to avoid double production.
    const orders = empaqueOrders.filter(
        (o) => !(o.uuid && outsourced.has(o.uuid))
    );
    // Serialize the Map<orderId, Map<itemId, qty>> down to plain JSON
    // so it can cross the Server→Client boundary. The board rebuilds
    // the Maps on mount.
    const initialDispatched: Record<string, Record<string, number>> = {};
    for (const [oid, lines] of totals.entries()) {
        initialDispatched[oid] = Object.fromEntries(lines.entries());
    }
    return (
        <EmpaqueBoard
            initialOrders={orders}
            initialCompletedOrderIds={Array.from(completed)}
            initialDispatched={initialDispatched}
        />
    );
}
