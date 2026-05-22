import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchAllStageNotifications } from '@/lib/services/stage-notifications';
import { CorteBoard } from '@/components/admin/corte-board';

export default async function CortePage() {
    const supabase = await createClient();
    const [all, notifications] = await Promise.all([
        fetchAllOrders(supabase),
        fetchAllStageNotifications(supabase)
    ]);
    const orders = all.filter((o) => o.status === 'corte');
    // Mark an order as "already notified" if it has any unacknowledged
    // corte notification — that prevents the operator from spamming the
    // admin with duplicate "finished" pings for the same order.
    const notifiedOrderIds = notifications
        .filter((n) => n.stage === 'corte' && !n.acknowledgedAt)
        .map((n) => n.orderId);
    return <CorteBoard initialOrders={orders} initialNotifiedOrderIds={notifiedOrderIds} />;
}
