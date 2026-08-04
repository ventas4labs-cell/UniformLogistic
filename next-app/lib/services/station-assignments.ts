import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Order ↔ station-user assignment ─────────────────────────────────
// Which orders is each station user responsible for. PK on the table
// blocks double-assignment. RLS limits station-user reads to their
// own rows; admin writes via service-role client.

export interface StationAssignment {
    orderId: string;
    stationUserId: string;
    assignedAt: string;
    assignedBy: string | null;
    // Pickup lifecycle: station flags ready → admin marks collected.
    readyForPickupAt: string | null;
    pickedUpAt: string | null;
    // Joined fields when loading for the admin assignment UI.
    stationUserEmail?: string;
    stationUserName?: string;
    stationUserStage?: string;
}

interface RawRow {
    order_id: string;
    station_user_id: string;
    assigned_at: string;
    assigned_by: string | null;
    ready_for_pickup_at: string | null;
    picked_up_at: string | null;
}

interface RawRowWithUser extends RawRow {
    station_user: {
        email: string;
        display_name: string;
        stage: string;
    } | null;
}

const ASSIGNMENT_COLS =
    'order_id, station_user_id, assigned_at, assigned_by, ready_for_pickup_at, picked_up_at';

/** All assignments for a given list of orders, with the station user name/stage joined. */
export async function fetchAssignmentsForOrders(
    supabase: SupabaseClient,
    orderIds: string[]
): Promise<StationAssignment[]> {
    if (orderIds.length === 0) return [];
    const { data, error } = await supabase
        .from('station_assignments')
        .select(
            `${ASSIGNMENT_COLS}, station_user:station_users(email, display_name, stage)`
        )
        .in('order_id', orderIds);
    if (error) throw error;
    return ((data || []) as unknown as RawRowWithUser[]).map((r) => ({
        orderId: r.order_id,
        stationUserId: r.station_user_id,
        assignedAt: r.assigned_at,
        assignedBy: r.assigned_by,
        readyForPickupAt: r.ready_for_pickup_at,
        pickedUpAt: r.picked_up_at,
        stationUserEmail: r.station_user?.email,
        stationUserName: r.station_user?.display_name,
        stationUserStage: r.station_user?.stage
    }));
}

// ─── Pickup status ───────────────────────────────────────────────────

export interface PickupStatus {
    readyForPickupAt: string | null;
    pickedUpAt: string | null;
}

/** Pickup status per order for one station — powers the station board's
 *  "listo para recoger" control. */
export async function fetchPickupStatusForStation(
    supabase: SupabaseClient,
    stationUserId: string
): Promise<Map<string, PickupStatus>> {
    const out = new Map<string, PickupStatus>();
    const { data, error } = await supabase
        .from('station_assignments')
        .select('order_id, ready_for_pickup_at, picked_up_at')
        .eq('station_user_id', stationUserId);
    if (error) throw error;
    for (const r of (data || []) as RawRow[]) {
        out.set(r.order_id, {
            readyForPickupAt: r.ready_for_pickup_at,
            pickedUpAt: r.picked_up_at
        });
    }
    return out;
}

export interface StationWorkRow {
    stationUserId: string;
    orderId: string;
    readyForPickupAt: string | null;
    pickedUpAt: string | null;
}

/** Every assignment whose station handles `stage`, with pickup status —
 *  drives the admin per-station view (e.g. all maquila outsourced work). */
export async function fetchAssignmentsForStage(
    supabase: SupabaseClient,
    stage: string
): Promise<StationWorkRow[]> {
    const { data, error } = await supabase
        .from('station_assignments')
        .select(
            'order_id, station_user_id, ready_for_pickup_at, picked_up_at, station_user:station_users!inner(stage)'
        )
        .eq('station_user.stage', stage);
    if (error) throw error;
    return ((data || []) as unknown as RawRowWithUser[]).map((r) => ({
        stationUserId: r.station_user_id,
        orderId: r.order_id,
        readyForPickupAt: r.ready_for_pickup_at,
        pickedUpAt: r.picked_up_at
    }));
}

/**
 * Of the given orders, which uuids have been outsourced to an EXTERNAL
 * station for `stage`. Each in-house stage board subtracts this set so
 * an order produced at an external workshop doesn't also show on the
 * local board (double production). Removing the assignment brings the
 * order back to the local board.
 */
export async function fetchOrdersOutsourcedToStage(
    supabase: SupabaseClient,
    orderIds: string[],
    stage: string
): Promise<Set<string>> {
    const assignments = await fetchAssignmentsForOrders(supabase, orderIds);
    return new Set(
        assignments
            .filter((a) => a.stationUserStage === stage)
            .map((a) => a.orderId)
    );
}

/** Order ids this station user is assigned to. Used by /station to scope the list. */
export async function fetchOrderIdsAssignedTo(
    supabase: SupabaseClient,
    stationUserId: string
): Promise<string[]> {
    const { data, error } = await supabase
        .from('station_assignments')
        .select('order_id')
        .eq('station_user_id', stationUserId);
    if (error) throw error;
    return (data || []).map((r: { order_id: string }) => r.order_id);
}

/** Is the given user assigned to this order? Used by the authorization
 *  check in markStageCompleteAction. */
export async function isStationAssignedToOrder(
    supabase: SupabaseClient,
    stationUserId: string,
    orderId: string
): Promise<boolean> {
    const { data, error } = await supabase
        .from('station_assignments')
        .select('order_id')
        .eq('station_user_id', stationUserId)
        .eq('order_id', orderId)
        .maybeSingle();
    if (error) throw error;
    return !!data;
}

export async function assignStationToOrder(
    serviceSupabase: SupabaseClient,
    orderId: string,
    stationUserId: string,
    assignedBy: string | null
): Promise<void> {
    const { error } = await serviceSupabase
        .from('station_assignments')
        .insert({
            order_id: orderId,
            station_user_id: stationUserId,
            assigned_by: assignedBy
        });
    if (error && !/duplicate/i.test(error.message)) throw error;
}

export async function unassignStationFromOrder(
    serviceSupabase: SupabaseClient,
    orderId: string,
    stationUserId: string
): Promise<void> {
    const { error } = await serviceSupabase
        .from('station_assignments')
        .delete()
        .eq('order_id', orderId)
        .eq('station_user_id', stationUserId);
    if (error) throw error;
}
