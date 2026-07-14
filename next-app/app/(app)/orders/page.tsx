import { History } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { fetchUserOrders } from '@/lib/services/orders';
import { fetchStageCompletionsForOrders } from '@/lib/services/stage-completions';
import { fetchDispatchTotalsForOrders } from '@/lib/services/dispatches';
import { fetchStockEntryTotalsForOrders } from '@/lib/services/stock-entries';
import { deriveOrderProgress } from '@/lib/customer-order-status';
import { OrderCard } from '@/components/customer/order-card';

export default async function OrdersPage() {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return null;

    const orders = await fetchUserOrders(supabase, user.id);
    const orderIds = orders.map((o) => o.uuid).filter((id): id is string => !!id);
    const [completions, dispatchTotals, stockTotals] = await Promise.all([
        fetchStageCompletionsForOrders(supabase, orderIds),
        fetchDispatchTotalsForOrders(supabase, orderIds),
        fetchStockEntryTotalsForOrders(supabase, orderIds)
    ]);

    return (
        <div className="p-4 pb-24 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">
                Historial de Pedidos
            </h2>

            {orders.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 dark:text-zinc-400">
                    <History size={48} className="mx-auto mb-4 opacity-30" />
                    <p>No hay pedidos anteriores.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map((order) => {
                        const progress = deriveOrderProgress(
                            order,
                            completions,
                            dispatchTotals,
                            stockTotals
                        );
                        return (
                            <OrderCard
                                key={order.uuid || order.id}
                                order={order}
                                progress={progress}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
