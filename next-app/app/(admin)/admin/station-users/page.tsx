import { createClient } from '@/utils/supabase/server';
import { fetchStationUsers } from '@/lib/services/station-users';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchAssignmentsForOrders } from '@/lib/services/station-assignments';
import { StationUsersManager } from '@/components/admin/station-users-manager';

export default async function StationUsersPage() {
    const supabase = await createClient();
    const [users, orders] = await Promise.all([
        fetchStationUsers(supabase),
        fetchAllOrders(supabase)
    ]);
    // Load existing assignments so the "Asignar pedido" modal can
    // grey out (or hide) the orders the chosen station already has.
    const orderIds = orders.map((o) => o.uuid).filter((id): id is string => !!id);
    const assignments = await fetchAssignmentsForOrders(supabase, orderIds);

    // Trim the orders list to the fields the modal actually needs —
    // avoids shipping every cart item / BOM through the server→client
    // boundary just to render a picker.
    const orderSummaries = orders
        .filter((o) => o.uuid && o.status !== 'cancelled')
        .map((o) => ({
            uuid: o.uuid as string,
            ref: o.id,
            companyName: o.companyName,
            createdAt: o.dateCreated,
            deliveryDate: o.deliveryDate,
            // Distinct product names so the station view shows what each
            // order actually contains, not just its ref/company.
            items: [...new Set(o.items.map((i) => i.productName).filter(Boolean))]
        }));

    return (
        <StationUsersManager
            initialUsers={users}
            orderSummaries={orderSummaries}
            initialAssignments={assignments.map((a) => ({
                orderId: a.orderId,
                stationUserId: a.stationUserId
            }))}
        />
    );
}
