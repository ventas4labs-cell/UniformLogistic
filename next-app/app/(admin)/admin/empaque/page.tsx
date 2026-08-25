import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { fetchDispatchTotalsForOrders } from '@/lib/services/dispatches';
import { fetchStockEntryTotalsForOrders } from '@/lib/services/stock-entries';
import { fetchAssignmentsForOrders } from '@/lib/services/station-assignments';
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
    const [completed, totals, addedToStock, assignments] = await Promise.all([
        fetchStageCompletions(supabase, 'empaque'),
        fetchDispatchTotalsForOrders(supabase, orderIds),
        fetchStockEntryTotalsForOrders(supabase, orderIds),
        fetchAssignmentsForOrders(supabase, orderIds)
    ]);
    // Full visibility (same model as the other stage boards): outsourced
    // orders stay on the board, badged with their station and isolatable
    // with the station picker, instead of vanishing from this view.
    const orders = empaqueOrders;
    const assignedStationsByOrder: Record<string, string[]> = {};
    for (const a of assignments) {
        if (a.stationUserStage !== 'empaque') continue;
        const name = a.stationUserName || a.stationUserEmail || 'Estación';
        (assignedStationsByOrder[a.orderId] ||= []).push(name);
    }
    // Serialize the Map<orderId, Map<itemId, qty>> down to plain JSON
    // so it can cross the Server→Client boundary. The board rebuilds
    // the Maps on mount.
    const initialDispatched: Record<string, Record<string, number>> = {};
    for (const [oid, lines] of totals.entries()) {
        initialDispatched[oid] = Object.fromEntries(lines.entries());
    }
    const initialAddedToStock: Record<string, Record<string, number>> = {};
    for (const [oid, lines] of addedToStock.entries()) {
        initialAddedToStock[oid] = Object.fromEntries(lines.entries());
    }
    return (
        <EmpaqueBoard
            initialOrders={orders}
            initialCompletedOrderIds={Array.from(completed)}
            initialDispatched={initialDispatched}
            initialAddedToStock={initialAddedToStock}
            assignedStationsByOrder={assignedStationsByOrder}
        />
    );
}
