import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { SimpleStageBoard } from '@/components/admin/simple-stage-board';

export default async function EmpaquePage() {
    const supabase = await createClient();
    const [all, completed] = await Promise.all([
        fetchAllOrders(supabase),
        fetchStageCompletions(supabase, 'empaque')
    ]);
    const orders = all.filter((o) => o.status !== 'cancelled');
    return (
        <SimpleStageBoard
            initialOrders={orders}
            initialCompletedOrderIds={Array.from(completed)}
            stage="empaque"
        />
    );
}
