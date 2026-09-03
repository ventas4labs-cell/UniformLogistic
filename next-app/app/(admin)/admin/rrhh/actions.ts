'use server';

import { randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { isAdminEmail } from '@/lib/admin-acting-company';
import {
    createEmployeeRow,
    fetchEmployee,
    fetchEmployeeByActivationToken,
    markEmployeeActivated,
    setEmployeeActivation,
    setEmployeeActive,
    updateEmployeeRow
} from '@/lib/services/employees';
import {
    createKioskRow,
    deleteKioskRow,
    setKioskAccessToken,
    setKioskActive
} from '@/lib/services/hr-kiosks';
import { upsertSchedule, type ScheduleInput } from '@/lib/services/hr-schedules';
import { sendEmployeeInviteEmail } from '@/lib/email/notifications';

// The invite link is single-use and expires; long enough that an
// employee has a couple of days to open it.
const INVITE_TTL_HOURS = 72;

/** URL-safe random token (no padding). Used as the /activar-empleado
 *  slug AND — for the throwaway initial auth password — a value the
 *  employee never sees (they set their own via the invite). */
function randomToken(bytes = 24): string {
    return randomBytes(bytes).toString('base64url');
}

async function requireAdmin() {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado.' as const, adminId: null };
    if (!isAdminEmail(user.email))
        return { error: 'No autorizado.' as const, adminId: null };
    return { error: null, adminId: user.id };
}

async function originFromHeaders(): Promise<string> {
    const h = await headers();
    return `${h.get('x-forwarded-proto') || 'https'}://${h.get('host')}`;
}

export interface CreateEmployeeInput {
    fullName: string;
    email: string;
    position?: string;
    phone?: string;
}

/**
 * Create an employee profile + auth account and email an invite so they
 * can set their own password. The auth user is created with the REAL
 * email already confirmed but a random, unshared password — so it can't
 * be signed into until the employee sets their own via the invite link.
 */
export async function createEmployeeAction(
    input: CreateEmployeeInput
): Promise<{ error?: string; warning?: string }> {
    const { error: adminErr, adminId } = await requireAdmin();
    if (adminErr) return { error: adminErr };

    const fullName = input.fullName.trim();
    const email = input.email.trim().toLowerCase();
    if (!fullName || !email) {
        return { error: 'Nombre y email son obligatorios.' };
    }

    const service = createServiceClient();
    const { data: created, error: authErr } = await service.auth.admin.createUser({
        email,
        password: randomToken(32),
        email_confirm: true,
        user_metadata: { full_name: fullName, role: 'employee' }
    });
    if (authErr || !created.user) {
        const msg = authErr?.message || 'error desconocido';
        // Most common cause: the email is already registered.
        return { error: `No se pudo crear el empleado: ${msg}` };
    }

    const token = randomToken();
    const expiresAt = new Date(
        Date.now() + INVITE_TTL_HOURS * 3600 * 1000
    ).toISOString();

    try {
        await createEmployeeRow(service, {
            id: created.user.id,
            fullName,
            email,
            position: (input.position || '').trim(),
            phone: (input.phone || '').trim(),
            activationToken: token,
            activationExpiresAt: expiresAt,
            createdBy: adminId
        });
    } catch (err) {
        // Roll back the orphan auth user so the email is free to retry.
        await service.auth.admin.deleteUser(created.user.id);
        const msg = err instanceof Error ? err.message : 'No se pudo registrar el empleado.';
        return { error: msg };
    }

    const origin = await originFromHeaders();
    const sent = await sendEmployeeInviteEmail(
        email,
        fullName,
        `${origin}/activar-empleado/${token}`,
        `${INVITE_TTL_HOURS} horas`
    );

    revalidatePath('/admin/rrhh');
    if (!sent.ok) {
        // Surface the provider's reason — a swallowed message here made a
        // misconfigured API key look like a generic failure.
        const detail = sent.error ? ` (${sent.error})` : '';
        return {
            warning:
                `El empleado se creó, pero no se pudo enviar el correo de invitación${detail}. Usá "Reenviar invitación".`
        };
    }
    return {};
}

/** Reissue the invite (new token + expiry) and resend the email. Works
 *  whether or not the employee already activated — acts as a password
 *  reset for an existing employee. */
export async function resendEmployeeInviteAction(
    userId: string
): Promise<{ error?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };

    const service = createServiceClient();
    const employee = await fetchEmployee(service, userId);
    if (!employee) return { error: 'Empleado no encontrado.' };

    const token = randomToken();
    const expiresAt = new Date(
        Date.now() + INVITE_TTL_HOURS * 3600 * 1000
    ).toISOString();
    try {
        await setEmployeeActivation(service, userId, token, expiresAt);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo generar la invitación.';
        return { error: msg };
    }

    const origin = await originFromHeaders();
    const sent = await sendEmployeeInviteEmail(
        employee.email,
        employee.fullName,
        `${origin}/activar-empleado/${token}`,
        `${INVITE_TTL_HOURS} horas`
    );
    revalidatePath('/admin/rrhh');
    if (!sent.ok) {
        const detail = sent.error ? ` (${sent.error})` : '';
        return {
            error: `No se pudo enviar el correo${detail}. Revisá el email e intentá de nuevo.`
        };
    }
    return {};
}

export async function updateEmployeeAction(
    userId: string,
    input: { fullName: string; position?: string; phone?: string }
): Promise<{ error?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    if (!input.fullName.trim()) return { error: 'El nombre es obligatorio.' };
    const service = createServiceClient();
    try {
        await updateEmployeeRow(service, userId, {
            fullName: input.fullName.trim(),
            position: (input.position || '').trim(),
            phone: (input.phone || '').trim()
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo actualizar.';
        return { error: msg };
    }
    revalidatePath('/admin/rrhh');
    return {};
}

export async function setEmployeeActiveAction(
    userId: string,
    isActive: boolean
): Promise<{ error?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    const service = createServiceClient();
    try {
        await setEmployeeActive(service, userId, isActive);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo cambiar el estado.';
        return { error: msg };
    }
    revalidatePath('/admin/rrhh');
    return {};
}

export async function deleteEmployeeAction(
    userId: string
): Promise<{ error?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    const service = createServiceClient();
    // Deleting the auth user cascades to the employees row (FK on delete
    // cascade), which will also cascade future HR tables keyed on it.
    const { error: authErr } = await service.auth.admin.deleteUser(userId);
    if (authErr) return { error: `No se pudo eliminar: ${authErr.message}` };
    revalidatePath('/admin/rrhh');
    return {};
}

// ─── Kiosks (shared punch screens) ──────────────────────────────────

export async function createKioskAction(
    label: string
): Promise<{ error?: string; accessToken?: string }> {
    const { error: adminErr, adminId } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    if (!label.trim()) return { error: 'Poné un nombre para el kiosco.' };
    const accessToken = randomToken(32);
    const service = createServiceClient();
    try {
        await createKioskRow(service, {
            label: label.trim(),
            accessToken,
            createdBy: adminId
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo crear el kiosco.';
        return { error: msg };
    }
    revalidatePath('/admin/rrhh');
    return { accessToken };
}

/** Rotate the kiosk's secret link (old URL stops working). */
export async function regenerateKioskTokenAction(
    id: string
): Promise<{ error?: string; accessToken?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    const accessToken = randomToken(32);
    const service = createServiceClient();
    try {
        await setKioskAccessToken(service, id, accessToken);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo rotar el enlace.';
        return { error: msg };
    }
    revalidatePath('/admin/rrhh');
    return { accessToken };
}

export async function setKioskActiveAction(
    id: string,
    isActive: boolean
): Promise<{ error?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    const service = createServiceClient();
    try {
        await setKioskActive(service, id, isActive);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo cambiar el estado.';
        return { error: msg };
    }
    revalidatePath('/admin/rrhh');
    return {};
}

export async function deleteKioskAction(id: string): Promise<{ error?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    const service = createServiceClient();
    try {
        await deleteKioskRow(service, id);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo eliminar.';
        return { error: msg };
    }
    revalidatePath('/admin/rrhh');
    return {};
}

// ─── Schedules ──────────────────────────────────────────────────────

export async function saveEmployeeScheduleAction(
    employeeId: string,
    input: ScheduleInput
): Promise<{ error?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    if (!input.workdays.length) return { error: 'Elegí al menos un día laboral.' };
    if (!input.startTime || !input.endTime) return { error: 'Definí hora de entrada y salida.' };
    const service = createServiceClient();
    try {
        await upsertSchedule(service, employeeId, {
            workdays: input.workdays,
            startTime: input.startTime,
            endTime: input.endTime,
            lunchMin: Math.max(0, input.lunchMin || 0),
            breakMin: Math.max(0, input.breakMin || 0),
            graceMin: Math.max(0, input.graceMin || 0)
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo guardar el horario.';
        return { error: msg };
    }
    revalidatePath('/admin/rrhh');
    revalidatePath('/admin/rrhh/asistencia');
    return {};
}

// ─── Employee self-service: set password from the invite link ────────
// Public (no admin session) — called by the /activar-empleado page. The
// token is the authorization; validated server-side against the row.

export async function setEmployeePasswordAction(
    token: string,
    password: string
): Promise<{ error?: string; ok?: boolean }> {
    if (!token || token.length < 16) return { error: 'Enlace inválido.' };
    if (!password || password.length < 8) {
        return { error: 'La contraseña debe tener al menos 8 caracteres.' };
    }

    const service = createServiceClient();
    const emp = await fetchEmployeeByActivationToken(service, token);
    if (!emp) return { error: 'Este enlace no es válido o ya se usó.' };
    if (emp.expired) {
        return { error: 'El enlace venció. Pedile al administrador que te reenvíe la invitación.' };
    }

    const { error: pwErr } = await service.auth.admin.updateUserById(emp.id, {
        password
    });
    if (pwErr) {
        return { error: 'No se pudo guardar la contraseña. Probá de nuevo.' };
    }

    await markEmployeeActivated(service, emp.id);
    return { ok: true };
}
