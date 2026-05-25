'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { updateOrderStatus, OrderStatus } from '@/lib/services/orders';
import {
    createStageNotification,
    acknowledgeStageNotification,
    unacknowledgeStageNotification,
    type Stage
} from '@/lib/services/stage-notifications';
import {
    markStageComplete,
    unmarkStageComplete,
    type StageKey
} from '@/lib/services/stage-completions';

// Stage-board status updates revalidate every stage page so an order
// moving from corte → maquila disappears from one board and appears on
// the next on the operator's next refresh.
const STAGE_PATHS = [
    '/admin/orders',
    '/admin/operador',
    '/admin/corte',
    '/admin/maquila',
    '/admin/impresion',
    '/admin/bordado',
    '/admin/empaque',
    '/admin/ploter'
];

export async function updateStageStatusAction(orderUuid: string, status: OrderStatus) {
    const supabase = await createClient();
    await updateOrderStatus(supabase, orderUuid, status);
    for (const p of STAGE_PATHS) revalidatePath(p);
}

// Per the user's spec: the "Finished" button does NOT auto-advance the
// order status — admins still decide when to move it to the next stage.
// Notifying only creates a stage_notification that surfaces on the bell
// in /admin/orders so the admin sees that the stage is done.
export async function notifyStageFinishedAction(
    orderUuid: string,
    stage: Stage,
    message?: string
) {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');
    await createStageNotification(supabase, {
        orderId: orderUuid,
        stage,
        message,
        createdBy: user.id
    });
    revalidatePath('/admin/orders');
    for (const p of STAGE_PATHS) revalidatePath(p);
}

export async function acknowledgeStageNotificationAction(notificationId: string) {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');
    await acknowledgeStageNotification(supabase, notificationId, user.id);
    revalidatePath('/admin/orders');
}

export async function unacknowledgeStageNotificationAction(notificationId: string) {
    const supabase = await createClient();
    await unacknowledgeStageNotification(supabase, notificationId);
    revalidatePath('/admin/orders');
}

// ─── Per-stage completion (new parallel-stage workflow) ──────────────
// Each operations board marks "this stage is done for this order"
// independently of the others. /admin/orders aggregates the four
// stages into a single completion strip per order.

export async function markStageCompleteAction(
    orderUuid: string,
    stage: StageKey,
    notes?: string
) {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');
    await markStageComplete(supabase, orderUuid, stage, user.id, notes);
    for (const p of STAGE_PATHS) revalidatePath(p);
}

export async function unmarkStageCompleteAction(
    orderUuid: string,
    stage: StageKey
) {
    const supabase = await createClient();
    await unmarkStageComplete(supabase, orderUuid, stage);
    for (const p of STAGE_PATHS) revalidatePath(p);
}
