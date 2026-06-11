'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import {
    createStationUserRow,
    setStationAccessToken,
    setStationUserActive
} from '@/lib/services/station-users';
import {
    assignStationToOrder,
    unassignStationFromOrder
} from '@/lib/services/station-assignments';
import { isAdminEmail } from '@/lib/admin-acting-company';
import type { StageKey } from '@/lib/services/stage-completions';

// In-house stage boards. An (un)assignment can outsource an order to
// any stage, so we revalidate every board afterward — each board
// subtracts the orders outsourced to its own external stations.
const STAGE_BOARD_PATHS = [
    '/admin/operador',
    '/admin/corte',
    '/admin/maquila',
    '/admin/impresion',
    '/admin/bordado',
    '/admin/empaque',
    '/admin/ploter'
];

/**
 * 32-byte URL-safe random token (no padding). Used as both the
 * /s/<token> slug the station bookmarks and the auth.users password
 * the /s route signs them in with.
 */
function generateAccessToken(): string {
    return randomBytes(32)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

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
    displayName: string;
    stage: StageKey;
}

/**
 * Create an external station account. Admin only supplies email +
 * name + stage — no password. The server mints a random access token
 * that doubles as the URL slug and the auth password, then returns
 * the token so the modal can show the share URL.
 */
export async function createStationUserAction(
    input: CreateStationUserInput
): Promise<{ error?: string; userId?: string; accessToken?: string }> {
    const { error: adminErr, adminId } = await requireAdmin();
    if (adminErr) return { error: adminErr };

    if (!input.email.trim() || !input.displayName.trim()) {
        return { error: 'Email y nombre son obligatorios.' };
    }

    const accessToken = generateAccessToken();
    const service = createServiceClient();

    // The access token doubles as the auth password — the /s/[token]
    // route signs the station in via signInWithPassword using the
    // token itself, so we don't need a separate admin-typed password.
    const { data: created, error: authErr } = await service.auth.admin.createUser({
        email: input.email.trim().toLowerCase(),
        password: accessToken,
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
            accessToken,
            createdBy: adminId
        });
    } catch (err) {
        await service.auth.admin.deleteUser(created.user.id);
        const msg = err instanceof Error ? err.message : 'No se pudo registrar la estación.';
        return { error: msg };
    }

    revalidatePath('/admin/station-users');
    revalidatePath('/admin/orders');
    return { userId: created.user.id, accessToken };
}

/**
 * Rotate the station's access token. Generates a new token, sets it
 * as the auth password (so /s/[old-token] stops working), and stores
 * it in station_users.access_token. Old bookmarks are invalidated.
 */
export async function regenerateStationAccessTokenAction(
    userId: string
): Promise<{ error?: string; accessToken?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };

    const newToken = generateAccessToken();
    const service = createServiceClient();

    const { error: authErr } = await service.auth.admin.updateUserById(userId, {
        password: newToken
    });
    if (authErr) {
        return { error: `No se pudo rotar el acceso: ${authErr.message}` };
    }

    try {
        await setStationAccessToken(service, userId, newToken);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo guardar el token.';
        return { error: msg };
    }

    revalidatePath('/admin/station-users');
    return { accessToken: newToken };
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
    // Outsourcing hides the order from the matching in-house board (and
    // unassigning brings it back) — refresh them all.
    for (const p of STAGE_BOARD_PATHS) revalidatePath(p);
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
    for (const p of STAGE_BOARD_PATHS) revalidatePath(p);
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
    for (const p of STAGE_BOARD_PATHS) revalidatePath(p);
    return { created, existing };
}
