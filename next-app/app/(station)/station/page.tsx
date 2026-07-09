import { createClient } from '@/utils/supabase/server';
import { fetchStationUser } from '@/lib/services/station-users';
import { fetchOrderIdsAssignedTo } from '@/lib/services/station-assignments';
import { fetchOrdersByIds } from '@/lib/services/orders';
import { fetchStageCompletions, STAGE_LABELS } from '@/lib/services/stage-completions';
import { fetchStageItemProgress } from '@/lib/services/stage-item-progress';
import { StationBoard } from '@/components/station/station-board';

// Restricted dashboard shown to external station users (corte /
// maquila / bordado / ploter / …). They only see the orders admin
// has assigned to them, and they can mark each order's stage as
// complete from here.

export default async function StationPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    // Layout has already redirected non-station users, so user + station are guaranteed.
    if (!user) return null;
    const station = await fetchStationUser(supabase, user.id);
    if (!station) return null;

    const orderIds = await fetchOrderIdsAssignedTo(supabase, user.id);
    const [orders, completedSet, progress] = await Promise.all([
        fetchOrdersByIds(supabase, orderIds),
        fetchStageCompletions(supabase, station.stage),
        fetchStageItemProgress(supabase, station.stage)
    ]);

    return (
        <StationBoard
            station={{
                id: station.id,
                displayName: station.displayName,
                stage: station.stage,
                stageLabel: STAGE_LABELS[station.stage] || station.stage
            }}
            initialOrders={orders.filter((o) => o.status !== 'cancelled')}
            initialCompletedOrderIds={Array.from(completedSet).filter((id) =>
                orderIds.includes(id)
            )}
            initialProgress={progress}
        />
    );
}
