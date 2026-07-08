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
import {
    saveStageItemProgress,
    type ProgressEntry
} from '@/lib/services/stage-item-progress';
import { fetchStationUser } from '@/lib/services/station-users';
import { isStationAssignedToOrder } from '@/lib/services/station-assignments';
import { isAdminEmail } from '@/lib/admin-acting-company';
import {
    createMissingReport,
    fetchAllReports,
    resolveReport,
    unresolveReport,
    type MissingInsumoReport
} from '@/lib/services/missing-insumos';

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

// ─── Partial stage progress (per-item) ───────────────────────────────
// Some stages (Bordado) finish an order in batches. The operator records
// how many pieces of each line are done. We persist those counts and
// then reconcile the binary completion: when every line is at its full
// quantity the stage is marked complete; if any line drops below full
// while the stage was complete, it's un-marked. Authorization mirrors
// the completion toggle (admin OR the assigned station for this stage).
export async function saveStageProgressAction(
    orderUuid: string,
    stage: StageKey,
    entries: ProgressEntry[]
): Promise<{ error?: string; completed?: boolean }> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado.' };
    if (!(await authorizeStageMutation(supabase, user.id, user.email, orderUuid, stage))) {
        return { error: 'No autorizado para esta etapa de este pedido.' };
    }

    try {
        await saveStageItemProgress(supabase, orderUuid, stage, entries, user.id);

        // Reconcile the binary completion against the true line
        // quantities (read from the DB, not the client payload).
        const { data: items, error } = await supabase
            .from('order_items')
            .select('id, quantity')
            .eq('order_id', orderUuid);
        if (error) throw error;

        const doneById = new Map(entries.map((e) => [e.orderItemId, Math.max(0, Math.round(e.qtyDone))]));
        const rows = (items || []) as { id: string; quantity: number }[];
        const allFull =
            rows.length > 0 &&
            rows.every((it) => (doneById.get(it.id) ?? 0) >= it.quantity);

        if (allFull) {
            await markStageComplete(supabase, orderUuid, stage, user.id);
        } else {
            // Not everything is done — make sure a stale "complete" flag
            // doesn't linger (e.g. operator corrected a count downward).
            await unmarkStageComplete(supabase, orderUuid, stage);
        }

        for (const p of STAGE_PATHS) revalidatePath(p);
        revalidatePath('/station');
        return { completed: allFull };
    } catch (err) {
        return {
            error: err instanceof Error ? err.message : 'No se pudo guardar el avance.'
        };
    }
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

// ─── Missing-item reports (all operation boards) ────────────────────
// Any operation module can flag a shortage against an order. Unlike the
// operator/maquila per-insumo report (which knows the BOM required qty),
// this is a free-text item + missing quantity, so required_qty defaults
// to 0 at the DB level. All reports — insumo-based or free-text — land
// in the same missing_insumo_reports table and share the history view.
export async function reportMissingItemAction(
    orderUuid: string,
    itemName: string,
    missingQty: number,
    notes?: string
): Promise<{ error?: string }> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado.' };
    if (!itemName.trim()) return { error: 'Indicá qué artículo falta.' };
    if (!Number.isFinite(missingQty) || missingQty <= 0) {
        return { error: 'La cantidad faltante debe ser mayor a cero.' };
    }
    try {
        await createMissingReport(supabase, {
            order_id: orderUuid,
            insumo_name: itemName.trim(),
            required_qty: 0,
            missing_qty: missingQty,
            reported_by: user.id,
            notes: notes?.trim() || undefined
        });
        for (const p of STAGE_PATHS) revalidatePath(p);
        return {};
    } catch (err) {
        return {
            error: err instanceof Error ? err.message : 'No se pudo enviar el reporte.'
        };
    }
}

// Read model for the history panel. Lazily called when the operator
// opens the "Historial de reportes" modal so we don't load reports into
// every board on mount.
export async function fetchMissingReportsAction(): Promise<MissingInsumoReport[]> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');
    return fetchAllReports(supabase);
}

export async function resolveMissingReportAction(
    reportId: string,
    resolved: boolean
): Promise<{ error?: string }> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado.' };
    try {
        if (resolved) await resolveReport(supabase, reportId);
        else await unresolveReport(supabase, reportId);
        for (const p of STAGE_PATHS) revalidatePath(p);
        return {};
    } catch (err) {
        return {
            error: err instanceof Error ? err.message : 'No se pudo actualizar el reporte.'
        };
    }
}
