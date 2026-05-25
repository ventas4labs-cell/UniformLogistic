import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchAllStageNotifications } from '@/lib/services/stage-notifications';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { CorteBoard } from '@/components/admin/corte-board';

export default async function CortePage() {
    const supabase = await createClient();
    const [all, notifications, completed] = await Promise.all([
        fetchAllOrders(supabase),
        fetchAllStageNotifications(supabase),
        fetchStageCompletions(supabase, 'corte')
    ]);
    // Workflow is no longer linear: every non-cancelled order shows up
    // on every board immediately. Corte marks its own work complete via
    // the per-stage completion toggle (independent of orders.status).
    const orders = all.filter((o) => o.status !== 'cancelled');
    const notifiedOrderIds = notifications
        .filter((n) => n.stage === 'corte' && !n.acknowledgedAt)
        .map((n) => n.orderId);
    return (
        <CorteBoard
            initialOrders={orders}
            initialNotifiedOrderIds={notifiedOrderIds}
            initialCompletedOrderIds={Array.from(completed)}
        />
    );
}
