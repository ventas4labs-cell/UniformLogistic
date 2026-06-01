'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import {
    createStationUserRow,
    setStationUserActive
} from '@/lib/services/station-users';
import {
    assignStationToOrder,
    unassignStationFromOrder
} from '@/lib/services/station-assignments';
import { isAdminEmail } from '@/lib/admin-acting-company';
import type { StageKey } from '@/lib/services/stage-completions';

// ─── Admin-only station-user management ──────────────────────────────
// Every action re-checks the admin email server-side before touching
// the service-role client. Layout-level guard plus this check means a
// stolen cookie alone can't escalate.

async function requireAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' as const, adminId: null };
    if (!isAdminEmail(user.email))
        return { error: 'No autorizado' as const, adminId: null };
    return { error: null, adminId: user.id };
}

export interface CreateStationUserInput {
    email: string;
    password: string;
    displayName: string;
    stage: StageKey;
}

export async function createStationUserAction(
    input: CreateStationUserInput
): Promise<{ error?: string; userId?: string }> {
    const { error: adminErr, adminId } = await requireAdmin();
    if (adminErr) return { error: adminErr };

    if (!input.email.trim() || !input.password.trim() || !input.displayName.trim()) {
        return { error: 'Email, contraseña y nombre son obligatorios.' };
    }
    if (input.password.length < 8) {
        return { error: 'La contraseña debe tener al menos 8 caracteres.' };
    }

    const service = createServiceClient();

    // Create the auth user via admin API. email_confirm: true so they
    // can log in immediately without an email round-trip.
    const { data: created, error: authErr } = await service.auth.admin.createUser({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        email_confirm: true,
        user_metadata: {
            full_name: input.displayName.trim(),
            role: 'station',
            stage: input.stage
        }
    });
    if (authErr || !created.user) {
        return { error: `No se pudo crear el usuario: ${authErr?.message || 'error desconocido'}` };
    }

    try {
        await createStationUserRow(service, {
            id: created.user.id,
            email: input.email.trim().toLowerCase(),
            displayName: input.displayName.trim(),
            stage: input.stage,
            createdBy: adminId
        });
    } catch (err) {
        // Roll back the auth user if we couldn't insert the station_users row.
        await service.auth.admin.deleteUser(created.user.id);
        const msg = err instanceof Error ? err.message : 'No se pudo registrar la estación.';
        return { error: msg };
    }

    revalidatePath('/admin/station-users');
    revalidatePath('/admin/orders');
    return { userId: created.user.id };
}

export async function setStationUserActiveAction(
    userId: string,
    isActive: boolean
): Promise<{ error?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    const service = createServiceClient();
    await setStationUserActive(service, userId, isActive);
    revalidatePath('/admin/station-users');
    revalidatePath('/admin/orders');
    return {};
}

export async function deleteStationUserAction(
    userId: string
): Promise<{ error?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    const service = createServiceClient();
    // Cascade on the station_users PK takes care of station_assignments
    // (FK is on auth.users with on delete cascade).
    const { error: authErr } = await service.auth.admin.deleteUser(userId);
    if (authErr) return { error: `No se pudo eliminar: ${authErr.message}` };
    revalidatePath('/admin/station-users');
    revalidatePath('/admin/orders');
    return {};
}

// ─── Assignment (called from Pedidos card) ───────────────────────────

export async function assignStationToOrderAction(
    orderId: string,
    stationUserId: string
): Promise<{ error?: string }> {
    const { error: adminErr, adminId } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    const service = createServiceClient();
    await assignStationToOrder(service, orderId, stationUserId, adminId);
    revalidatePath('/admin/orders');
    revalidatePath('/station');
    return {};
}

export async function unassignStationFromOrderAction(
    orderId: string,
    stationUserId: string
): Promise<{ error?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    const service = createServiceClient();
    await unassignStationFromOrder(service, orderId, stationUserId);
    revalidatePath('/admin/orders');
    revalidatePath('/station');
    return {};
}

/**
 * Bulk-assign N orders to one station user. Skips any pair that
 * already exists (returns the count of new vs. already-assigned).
 * Called from the Pedidos multi-select flow.
 */
export async function bulkAssignStationToOrdersAction(
    orderIds: string[],
    stationUserId: string
): Promise<{ error?: string; created?: number; existing?: number }> {
    const { error: adminErr, adminId } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    if (!stationUserId) return { error: 'Falta la estación.' };
    if (!orderIds.length) return { error: 'No hay pedidos seleccionados.' };

    const service = createServiceClient();
    // Insert all pairs in one round-trip. The unique PK
    // (order_id, station_user_id) prevents duplicates; we use
    // upsert with ignoreDuplicates so the call doesn't fail when
    // some pairs already exist (we just report the existing count).
    const rows = orderIds.map((order_id) => ({
        order_id,
        station_user_id: stationUserId,
        assigned_by: adminId
    }));
    const { data, error } = await service
        .from('station_assignments')
        .upsert(rows, { onConflict: 'order_id,station_user_id', ignoreDuplicates: true })
        .select('order_id');
    if (error) return { error: `No se pudo asignar: ${error.message}` };

    const created = data?.length || 0;
    const existing = orderIds.length - created;
    revalidatePath('/admin/orders');
    revalidatePath('/admin/station-users');
    revalidatePath('/station');
    return { created, existing };
}
