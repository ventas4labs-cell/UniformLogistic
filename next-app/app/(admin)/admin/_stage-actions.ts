'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    updateOrderStatus,
    addExtraOrderItem,
    OrderStatus,
    type ExtraItemInput
} from '@/lib/services/orders';
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
import { fetchStationUser } from '@/lib/services/station-users';
import { isStationAssignedToOrder } from '@/lib/services/station-assignments';
import { isAdminEmail } from '@/lib/admin-acting-company';

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

/**
 * Returns true if the caller is allowed to mutate the (order, stage)
 * completion. Admin can do anything. A station user can only toggle
 * the completion for THEIR assigned stage on orders THEY're assigned
 * to. Anyone else is rejected.
 */
async function authorizeStageMutation(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    userEmail: string | null | undefined,
    orderUuid: string,
    stage: StageKey
): Promise<boolean> {
    if (isAdminEmail(userEmail)) return true;
    const station = await fetchStationUser(supabase, userId);
    if (!station) return false;
    if (!station.isActive) return false;
    if (station.stage !== stage) return false;
    return isStationAssignedToOrder(supabase, userId, orderUuid);
}

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
    if (!(await authorizeStageMutation(supabase, user.id, user.email, orderUuid, stage))) {
        throw new Error('No autorizado para esta etapa de este pedido.');
    }
    await markStageComplete(supabase, orderUuid, stage, user.id, notes);
    for (const p of STAGE_PATHS) revalidatePath(p);
    revalidatePath('/station');
}

export async function unmarkStageCompleteAction(
    orderUuid: string,
    stage: StageKey
) {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');
    if (!(await authorizeStageMutation(supabase, user.id, user.email, orderUuid, stage))) {
        throw new Error('No autorizado para esta etapa de este pedido.');
    }
    await unmarkStageComplete(supabase, orderUuid, stage);
    for (const p of STAGE_PATHS) revalidatePath(p);
    revalidatePath('/station');
}

// ─── Corte: add an extra line item ───────────────────────────────────
// The corte operator (admin OR the assigned corte station) can add an
// extra piece beyond the placed order — a replacement, a sample, a
// forgotten size. Stored as a normal order_items row flagged
// is_extra=true. Authorization mirrors the stage-completion check:
// admin OR an active corte station assigned to this order.
export async function addCorteExtraItemAction(
    orderUuid: string,
    input: ExtraItemInput
): Promise<{ error?: string; itemId?: string }> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado.' };
    if (!(await authorizeStageMutation(supabase, user.id, user.email, orderUuid, 'corte'))) {
        return { error: 'No autorizado para esta orden.' };
    }
    if (!input.productName.trim()) return { error: 'El producto es obligatorio.' };
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
        return { error: 'La cantidad debe ser mayor a cero.' };
    }
    try {
        const itemId = await addExtraOrderItem(supabase, orderUuid, input, user.id);
        for (const p of STAGE_PATHS) revalidatePath(p);
        revalidatePath('/station');
        return { itemId };
    } catch (err) {
        return {
            error: err instanceof Error ? err.message : 'No se pudo agregar el extra.'
        };
    }
}
