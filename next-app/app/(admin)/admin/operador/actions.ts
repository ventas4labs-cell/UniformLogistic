'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { updateOrderStatus, OrderStatus } from '@/lib/services/orders';
import { createMissingReport } from '@/lib/services/missing-insumos';
import {
    markInsumoComplete,
    unmarkInsumoComplete,
} from '@/lib/services/insumo-completions';
import { setInsumoPreparation } from '@/lib/services/insumo-preparations';
import { isAdminEmail } from '@/lib/admin-acting-company';

// Defence in depth: the (admin) layout redirect does NOT protect server
// actions — an action runs and commits before that render pass, and it is
// addressed by action id, so it can be POSTed from any page the caller can
// load. Every mutation re-checks that the caller is the admin.
async function assertAdmin(): Promise<void> {
    const _sb = await createClient();
    const {
        data: { user }
    } = await _sb.auth.getUser();
    if (!user || !isAdminEmail(user.email)) throw new Error('No autorizado.');
}


export async function updateOrderStatusAction(orderUuid: string, status: OrderStatus) {
    await assertAdmin();
    const supabase = await createClient();
    await updateOrderStatus(supabase, orderUuid, status);
    revalidatePath('/admin/operador');
}

export async function reportMissingInsumoAction(
    orderId: string,
    insumoName: string,
    requiredQty: number,
    missingQty: number,
    notes?: string,
    stage?: string
) {
    await assertAdmin();
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
        stage,
    });

    revalidatePath('/admin/operador');
    revalidatePath('/admin/maquila');
    revalidatePath('/admin/orders');
}

export async function toggleInsumoCompleteAction(
    orderId: string,
    insumoName: string,
    completed: boolean
) {
    await assertAdmin();
    const supabase = await createClient();
    if (completed) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No autenticado');
        await markInsumoComplete(supabase, orderId, insumoName, user.id);
    } else {
        await unmarkInsumoComplete(supabase, orderId, insumoName);
    }
    revalidatePath('/admin/operador');
    revalidatePath('/admin/maquila');
}

export async function setInsumoPreparationAction(
    orderId: string,
    insumoName: string,
    qty: number
) {
    await assertAdmin();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');
    await setInsumoPreparation(supabase, orderId, insumoName, qty, user.id);
    revalidatePath('/admin/operador');
}
