'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { updateOrderStatus, OrderStatus } from '@/lib/services/orders';

export async function updateOrderStatusAction(orderUuid: string, status: OrderStatus) {
    const supabase = await createClient();
    await updateOrderStatus(supabase, orderUuid, status);
    revalidatePath('/admin/orders');
}
