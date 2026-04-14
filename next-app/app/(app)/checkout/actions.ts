'use server';

import { createClient } from '@/utils/supabase/server';
import { createOrder } from '@/lib/services/orders';
import type { CartItem, CustomerForm } from '@/lib/types';

export interface SubmitOrderResult {
    error?: string;
    orderRef?: string;
}

export async function submitOrderAction(
    form: CustomerForm,
    cart: CartItem[]
): Promise<SubmitOrderResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: 'Tu sesión expiró. Vuelve a iniciar sesión.' };
    if (!cart || cart.length === 0) return { error: 'Tu carrito está vacío.' };

    try {
        const result = await createOrder(supabase, user.id, form, cart);
        return { orderRef: result.orderRef };
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo guardar el pedido.';
        return { error: `No se pudo guardar el pedido: ${msg}` };
    }
}
