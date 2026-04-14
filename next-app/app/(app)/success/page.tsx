import Link from 'next/link';
import { Check } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { fetchUserOrders } from '@/lib/services/orders';

interface Props {
    searchParams: Promise<{ ref?: string }>;
}

export default async function SuccessPage({ searchParams }: Props) {
    const { ref } = await searchParams;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const orders = await fetchUserOrders(supabase, user.id);
    const order = ref ? orders.find((o) => o.id === ref) : orders[0];

    const totalPieces = order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
    const lineCount = order?.items.length ?? 0;

    return (
        <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center p-8 text-center">
            <div className="bg-green-100 p-6 rounded-full mb-6 text-green-600">
                <Check size={48} />
            </div>
            <h2 className="text-3xl font-bold text-zinc-900 mb-2">¡Pedido Confirmado!</h2>
            {order && (
                <>
                    <p className="text-zinc-600 mb-2">
                        Ref: <span className="font-mono font-bold">{order.id}</span>
                    </p>
                    <p className="text-sm text-zinc-500 mb-6">
                        {totalPieces} {totalPieces === 1 ? 'pieza' : 'piezas'} en {lineCount}{' '}
                        {lineCount === 1 ? 'línea' : 'líneas'}
                        {order.deliveryDate && ` · Entrega est. ${order.deliveryDate}`}
                    </p>
                </>
            )}

            <div className="space-y-4 w-full max-w-sm">
                <Link
                    href="/orders"
                    className="block w-full py-3 bg-orange-600 text-white rounded-xl font-bold shadow-md hover:bg-orange-700 transition-colors text-center"
                >
                    Ver Historial de Pedidos
                </Link>
                <Link
                    href="/home"
                    className="block w-full py-3 border border-zinc-300 text-zinc-600 rounded-xl font-semibold text-center"
                >
                    Volver al Inicio
                </Link>
            </div>
        </div>
    );
}
