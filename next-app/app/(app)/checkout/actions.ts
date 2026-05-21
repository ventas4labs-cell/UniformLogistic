'use server';

import { createClient } from '@/utils/supabase/server';
import { createOrder } from '@/lib/services/orders';
import {
    clearActingCompanyId,
    getActingCompanyId,
    isAdminEmail
} from '@/lib/admin-acting-company';
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

    // Admin places orders on behalf of a customer company via the
    // acting-company cookie. The cookie was validated when set (admin
    // gate inside setActingCompanyAction), but we re-check the email
    // here so a stolen cookie alone can't bypass the gate.
    let companyIdOverride: string | undefined;
    if (isAdminEmail(user.email)) {
        companyIdOverride = (await getActingCompanyId()) || undefined;
        if (!companyIdOverride) {
            return {
                error:
                    'Selecciona la empresa antes de finalizar el pedido (vuelve al catálogo).'
            };
        }
    }

    try {
        const result = await createOrder(
            supabase,
            user.id,
            form,
            cart,
            companyIdOverride
        );
        // Clear the admin's acting-company cookie after the order is
        // booked. Next admin order starts from a fresh picker so we
        // never silently bill the wrong company.
        if (companyIdOverride) await clearActingCompanyId();
        return { orderRef: result.orderRef };
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo guardar el pedido.';
        return { error: `No se pudo guardar el pedido: ${msg}` };
    }
}
