import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { fetchStageItemProgress } from '@/lib/services/stage-item-progress';
import { fetchLogos } from '@/lib/services/logos';
import { fetchAssignmentsForOrders } from '@/lib/services/station-assignments';
import { orderNeedsStage } from '@/lib/stage-utils';
import { SimpleStageBoard } from '@/components/admin/simple-stage-board';

export default async function BordadoPage() {
    const supabase = await createClient();
    const [all, completed, progress, logos] = await Promise.all([
        fetchAllOrders(supabase),
        fetchStageCompletions(supabase, 'bordado'),
        fetchStageItemProgress(supabase, 'bordado'),
        fetchLogos(supabase)
    ]);
    const bordadoOrders = all.filter(
        (o) => o.status !== 'cancelled' && orderNeedsStage(o, 'bordado')
    );
    // Full visibility (same model as Corte): show ALL bordado orders and,
    // for the ones handed to an external workshop, note which station —
    // surfaced via the board's "Todos / Asignados a estación" scope tab,
    // the station picker, and a per-card badge. Previously these were
    // hidden entirely, which made outsourced work impossible to track
    // from here.
    const bordadoOrderIds = bordadoOrders
        .map((o) => o.uuid)
        .filter((id): id is string => !!id);
    const assignments = await fetchAssignmentsForOrders(supabase, bordadoOrderIds);
    const assignedStationsByOrder: Record<string, string[]> = {};
    for (const a of assignments) {
        if (a.stationUserStage !== 'bordado') continue;
        const name = a.stationUserName || a.stationUserEmail || 'Estación';
        (assignedStationsByOrder[a.orderId] ||= []).push(name);
    }
    return (
        <SimpleStageBoard
            initialOrders={bordadoOrders}
            initialCompletedOrderIds={Array.from(completed)}
            stage="bordado"
            logos={logos}
            allowPartial
            initialProgress={progress}
            assignedStationsByOrder={assignedStationsByOrder}
        />
    );
}
