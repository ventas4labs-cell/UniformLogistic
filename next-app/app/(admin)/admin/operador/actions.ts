'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { updateOrderStatus, OrderStatus } from '@/lib/services/orders';
import { createMissingReport } from '@/lib/services/missing-insumos';
import {
    markInsumoComplete,
    unmarkInsumoComplete,
} from '@/lib/services/insumo-completions';

export async function updateOrderStatusAction(orderUuid: string, status: OrderStatus) {
    const supabase = await createClient();
    await updateOrderStatus(supabase, orderUuid, status);
    revalidatePath('/admin/operador');
}

export async function reportMissingInsumoAction(
    orderId: string,
    insumoName: string,
    requiredQty: number,
    missingQty: number,
    notes?: string
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    await createMissingReport(supabase, {
        order_id: orderId,
        insumo_name: insumoName,
        required_qty: requiredQty,
        missing_qty: missingQty,
        reported_by: user.id,
        notes,
    });

    revalidatePath('/admin/operador');
    revalidatePath('/admin/notificaciones');
}

export async function toggleInsumoCompleteAction(
    orderId: string,
    insumoName: string,
    completed: boolean
) {
    const supabase = await createClient();
    if (completed) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No autenticado');
        await markInsumoComplete(supabase, orderId, insumoName, user.id);
    } else {
        await unmarkInsumoComplete(supabase, orderId, insumoName);
    }
    revalidatePath('/admin/operador');
}
