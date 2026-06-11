import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { fetchStageCompletions } from '@/lib/services/stage-completions';
import { fetchLogos } from '@/lib/services/logos';
import { fetchOrdersOutsourcedToStage } from '@/lib/services/station-assignments';
import { orderNeedsStage } from '@/lib/stage-utils';
import { ImpresionBoard } from '@/components/admin/impresion-board';

export default async function ImpresionPage() {
    const supabase = await createClient();
    const [all, completed, logos] = await Promise.all([
        fetchAllOrders(supabase),
        fetchStageCompletions(supabase, 'impresion'),
        fetchLogos(supabase)
    ]);
    const impresionOrders = all.filter(
        (o) => o.status !== 'cancelled' && orderNeedsStage(o, 'impresion')
    );
    // Orders sent to an external impresión station are produced there, so
    // hide them from this in-house board to avoid double production.
    const outsourced = await fetchOrdersOutsourcedToStage(
        supabase,
        impresionOrders.map((o) => o.uuid).filter((id): id is string => !!id),
        'impresion'
    );
    const orders = impresionOrders.filter(
        (o) => !(o.uuid && outsourced.has(o.uuid))
    );
    return (
        <ImpresionBoard
            initialOrders={orders}
            initialCompletedOrderIds={Array.from(completed)}
            logos={logos}
        />
    );
}
