import { History } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { fetchUserOrders } from '@/lib/services/orders';

export default async function OrdersPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const orders = await fetchUserOrders(supabase, user.id);

    return (
        <div className="p-4 pb-24 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Historial de Pedidos</h2>

            {orders.length === 0 ? (
                <div className="text-center py-10 text-zinc-500">
                    <History size={48} className="mx-auto mb-4 opacity-30" />
                    <p>No hay pedidos anteriores.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map((order) => {
                        const totalPieces = order.items.reduce((s, i) => s + i.quantity, 0);
                        return (
                            <div
                                key={order.uuid || order.id}
                                className="bg-white p-4 rounded-xl shadow-sm border border-zinc-100"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-bold text-zinc-900">{order.id}</h3>
                                        <p className="text-xs text-zinc-500">
                                            {new Date(order.dateCreated).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">
                                        {order.items.length} artículos · {totalPieces} piezas
                                    </span>
                                </div>
                                <p className="text-sm text-zinc-700 mt-3">
                                    Cliente: {order.customerName} ({order.companyName})
                                </p>
                                {order.status && (
                                    <p className="text-xs text-zinc-500 mt-1">
                                        Estado: <span className="font-semibold">{order.status}</span>
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
