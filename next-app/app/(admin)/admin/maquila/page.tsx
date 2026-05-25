import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { MaquilaBoard } from '@/components/admin/maquila-board';

export default async function MaquilaPage() {
    const supabase = await createClient();
    const [all, completed] = await Promise.all([
        fetchAllOrders(supabase),
        fetchStageCompletions(supabase, 'maquila')
    ]);
    const orders = all.filter((o) => o.status !== 'cancelled');
    return (
        <MaquilaBoard
            initialOrders={orders}
            initialCompletedOrderIds={Array.from(completed)}
        />
    );
}
