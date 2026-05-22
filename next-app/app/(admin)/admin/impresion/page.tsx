import { createClient } from '@/utils/supabase/server';
import { fetchAllOrders } from '@/lib/services/orders';
import { ImpresionBoard } from '@/components/admin/impresion-board';

export default async function ImpresionPage() {
    const supabase = await createClient();
    const all = await fetchAllOrders(supabase);
    const orders = all.filter((o) => o.status === 'impresion');
    return <ImpresionBoard initialOrders={orders} />;
}
