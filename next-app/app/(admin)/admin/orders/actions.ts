'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    updateOrderStatus,
    deleteOrder,
    updateOrderFull,
    OrderStatus,
    UpdateOrderHeaderInput,
    OrderItemInput
} from '@/lib/services/orders';
import { resolveReport, unresolveReport } from '@/lib/services/missing-insumos';

export async function updateOrderStatusAction(orderUuid: string, status: OrderStatus) {
    const supabase = await createClient();
    await updateOrderStatus(supabase, orderUuid, status);
    revalidatePath('/admin/orders');
}

export async function deleteOrderAction(orderUuid: string) {
    const supabase = await createClient();
    await deleteOrder(supabase, orderUuid);
    revalidatePath('/admin/orders');
    revalidatePath('/admin/operador');
}

export async function updateOrderAction(
    orderUuid: string,
    header: UpdateOrderHeaderInput,
    items: OrderItemInput[]
) {
    const supabase = await createClient();
    await updateOrderFull(supabase, orderUuid, header, items);
    revalidatePath('/admin/orders');
    revalidatePath('/admin/operador');
}

// Inline notifications: missing-insumo reports surface as a bell on
// each affected order card. Resolving/reopening lives here now that
// the standalone /admin/notificaciones page is gone.
export async function resolveOrderReportAction(reportId: string) {
    const supabase = await createClient();
    await resolveReport(supabase, reportId);
    revalidatePath('/admin/orders');
}

export async function unresolveOrderReportAction(reportId: string) {
    const supabase = await createClient();
    await unresolveReport(supabase, reportId);
    revalidatePath('/admin/orders');
}
