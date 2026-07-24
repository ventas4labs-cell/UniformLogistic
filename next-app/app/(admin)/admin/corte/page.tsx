import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { fetchStageItemProgress } from '@/lib/services/stage-item-progress';
import { fetchAssignmentsForOrders } from '@/lib/services/station-assignments';
import { fetchCorteFabricReports } from '@/lib/services/corte-fabric-reports';
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
    // Full visibility: show ALL corte orders and, for the ones handed to
    // an external corte station, note which station — surfaced via the
    // board's "Todos / Asignados a estación" tab and a per-card badge.
    const corteOrderIds = corteOrders
        .map((o) => o.uuid)
        .filter((id): id is string => !!id);
    const [assignments, fabricReportsByOrder] = await Promise.all([
        fetchAssignmentsForOrders(supabase, corteOrderIds),
        fetchCorteFabricReports(supabase, corteOrderIds)
    ]);
    const assignedStationsByOrder: Record<string, string[]> = {};
    for (const a of assignments) {
        if (a.stationUserStage !== 'corte') continue;
        const name = a.stationUserName || a.stationUserEmail || 'Estación';
        (assignedStationsByOrder[a.orderId] ||= []).push(name);
    }
    return (
        <CorteBoard
            initialOrders={corteOrders}
            initialCompletedOrderIds={Array.from(completed)}
            initialProgress={progress}
            assignedStationsByOrder={assignedStationsByOrder}
            fabricReportsByOrder={fabricReportsByOrder}
        />
    );
}
