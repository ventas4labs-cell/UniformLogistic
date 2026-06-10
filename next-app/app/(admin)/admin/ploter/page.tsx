import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { orderNeedsStage } from '@/lib/stage-utils';
import { SimpleStageBoard } from '@/components/admin/simple-stage-board';

export default async function PloterPage() {
    const supabase = await createClient();
    const [all, completed] = await Promise.all([
        fetchAllOrders(supabase),
        fetchStageCompletions(supabase, 'ploter')
    ]);
    const orders = all.filter(
        (o) => o.status !== 'cancelled' && orderNeedsStage(o, 'ploter')
    );
    return (
        <SimpleStageBoard
            initialOrders={orders}
            initialCompletedOrderIds={Array.from(completed)}
            stage="ploter"
        />
    );
}
