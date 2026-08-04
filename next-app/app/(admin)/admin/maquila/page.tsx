import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders, fetchOrdersByIds } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { fetchCompletionsForOrders } from '@/lib/services/insumo-completions';
import {
    fetchOrdersOutsourcedToStage,
    fetchAssignmentsForStage
} from '@/lib/services/station-assignments';
import { fetchStationUsers } from '@/lib/services/station-users';
import { orderNeedsStage } from '@/lib/stage-utils';
import { MaquilaModule } from '@/components/admin/maquila-module';
import type { StationWorkItem } from '@/components/admin/external-station-panel';

export default async function MaquilaPage() {
    const supabase = await createClient();
    const all = await fetchAllOrders(supabase);
    const maquilaOrders = all.filter(
        (o) => o.status !== 'cancelled' && orderNeedsStage(o, 'maquila')
    );
    const orderIds = maquilaOrders
        .map((o) => o.uuid)
        .filter((id): id is string => !!id);

    const [completed, insumoCompletions, outsourced, stationUsers, stageAssignments] =
        await Promise.all([
            fetchStageCompletions(supabase, 'maquila'),
            fetchCompletionsForOrders(supabase, orderIds),
            fetchOrdersOutsourcedToStage(supabase, orderIds, 'maquila'),
            fetchStationUsers(supabase),
            fetchAssignmentsForStage(supabase, 'maquila')
        ]);

    // In-house board: maquila orders NOT sent to an external workshop.
    const inHouseOrders = maquilaOrders.filter(
        (o) => !(o.uuid && outsourced.has(o.uuid))
    );

    // External maquila stations (active) and their assigned orders with
    // pickup status. Fetch the full order detail for every assigned id.
    const maquilaStations = stationUsers.filter(
        (s) => s.stage === 'maquila' && s.isActive
    );
    const externalOrderIds = Array.from(
        new Set(stageAssignments.map((a) => a.orderId))
    );
    const externalOrders = await fetchOrdersByIds(supabase, externalOrderIds);
    const orderByUuid = new Map(
        externalOrders
            .filter((o) => o.uuid && o.status !== 'cancelled')
            .map((o) => [o.uuid as string, o])
    );

    const workByStation: Record<string, StationWorkItem[]> = {};
    for (const s of maquilaStations) workByStation[s.id] = [];
    for (const a of stageAssignments) {
        const order = orderByUuid.get(a.orderId);
        if (!order) continue;
        (workByStation[a.stationUserId] ||= []).push({
            order,
            readyForPickupAt: a.readyForPickupAt,
            pickedUpAt: a.pickedUpAt
        });
    }

    return (
        <MaquilaModule
            inHouse={{
                initialOrders: inHouseOrders,
                initialCompletedOrderIds: Array.from(completed),
                initialInsumoCompletions: insumoCompletions
            }}
            stations={maquilaStations.map((s) => ({ id: s.id, name: s.displayName }))}
            workByStation={workByStation}
        />
    );
}
