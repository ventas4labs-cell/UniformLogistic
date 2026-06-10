import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { orderNeedsStage } from '@/lib/stage-utils';
import { ImpresionBoard } from '@/components/admin/impresion-board';

export default async function ImpresionPage() {
    const supabase = await createClient();
    const [all, completed] = await Promise.all([
        fetchAllOrders(supabase),
        fetchStageCompletions(supabase, 'impresion')
    ]);
    const orders = all.filter(
        (o) => o.status !== 'cancelled' && orderNeedsStage(o, 'impresion')
    );
    return (
        <ImpresionBoard
            initialOrders={orders}
            initialCompletedOrderIds={Array.from(completed)}
        />
    );
}
