'use server';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
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
import { reviewTimeOffRequest } from '@/lib/services/hr-time-off';
import {
    addDaysStr,
    crDateTimeToIso,
    crToday,
    PUNCH_TYPES,
    type PunchType
} from '@/lib/services/hr-punches';
import { correctPunch, type PunchEditAction } from '@/lib/services/hr-punch-edits';
import { scheduledJornadaMin, upsertPayRate } from '@/lib/services/hr-payroll';
import { sendEmployeeInviteEmail } from '@/lib/email/notifications';

// The invite link is single-use and expires; long enough that an
// employee has a couple of days to open it.
const INVITE_TTL_HOURS = 72;

// Anything above this is a typo (an extra zero), not a wage.
const MAX_HOURLY_RATE = 1_000_000;

/** Validate a salario por hora from the form: colones, > 0, 2 decimals. */
function parseHourlyRate(value: number): { rate: number } | { error: string } {
    if (!Number.isFinite(value) || value <= 0)
        return { error: 'El salario por hora debe ser un monto mayor a 0.' };
    if (value > MAX_HOURLY_RATE)
        return { error: 'Ese salario por hora parece demasiado alto. Revisá el monto.' };
    return { rate: Math.round(value * 100) / 100 };
}

/** "YYYY-MM-DD" that is a real calendar date (rejects 2026-02-31). */
const isRealDate = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) && addDaysStr(s, 0) === s;

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
    /** Salario por hora in colones; null/undefined = not set yet. */
    hourlyRate?: number | null;
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
    let hourlyRate: number | null = null;
    if (input.hourlyRate != null) {
        const parsed = parseHourlyRate(input.hourlyRate);
        if ('error' in parsed) return { error: parsed.error };
        hourlyRate = parsed.rate;
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

    const warnings: string[] = [];
    if (hourlyRate != null) {
        try {
            // The first rate also covers any hours before today (see
            // rateEntryOn), so its start date is just a record.
            await upsertPayRate(service, {
                employeeId: created.user.id,
                hourlyRate,
                effectiveFrom: crToday(),
                createdBy: adminId
            });
        } catch {
            warnings.push(
                'El empleado se creó, pero no se pudo guardar el salario por hora. Editalo para intentarlo de nuevo.'
            );
        }
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
        warnings.push(
            `El empleado se creó, pero no se pudo enviar el correo de invitación${detail}. Usá "Reenviar invitación".`
        );
    }
    return warnings.length ? { warning: warnings.join(' ') } : {};
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

export interface UpdateEmployeeInput {
    fullName: string;
    position?: string;
    phone?: string;
    /** Only sent when the salario por hora changed. */
    pay?: {
        hourlyRate: number;
        /** CR date the new rate applies from; earlier hours keep the
         *  previous rate. */
        effectiveFrom: string;
    } | null;
}

export async function updateEmployeeAction(
    userId: string,
    input: UpdateEmployeeInput
): Promise<{ error?: string }> {
    const { error: adminErr, adminId } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    if (!input.fullName.trim()) return { error: 'El nombre es obligatorio.' };
    let pay: { hourlyRate: number; effectiveFrom: string } | null = null;
    if (input.pay) {
        const parsed = parseHourlyRate(input.pay.hourlyRate);
        if ('error' in parsed) return { error: parsed.error };
        if (!isRealDate(input.pay.effectiveFrom))
            return { error: 'Elegí desde qué fecha rige el salario.' };
        pay = { hourlyRate: parsed.rate, effectiveFrom: input.pay.effectiveFrom };
    }

    const service = createServiceClient();
    if (!(await fetchEmployee(service, userId))) return { error: 'Empleado no encontrado.' };
    try {
        await updateEmployeeRow(service, userId, {
            fullName: input.fullName.trim(),
            position: (input.position || '').trim(),
            phone: (input.phone || '').trim()
        });
        if (pay) {
            await upsertPayRate(service, {
                employeeId: userId,
                hourlyRate: pay.hourlyRate,
                effectiveFrom: pay.effectiveFrom,
                createdBy: adminId
            });
        }
    } catch (err) {
        // PostgREST errors are plain objects, not Error instances.
        const msg = (err as { message?: string } | null)?.message || 'No se pudo actualizar.';
        return { error: msg };
    }
    revalidatePath('/admin/rrhh');
    revalidatePath('/admin/rrhh/planilla');
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
    // The jornada (salida − entrada − almuerzo) is what the planilla pays
    // as ordinary time, so it has to be positive. Shifts past midnight
    // aren't supported: punches are grouped by calendar day.
    if (
        scheduledJornadaMin({
            startTime: input.startTime,
            endTime: input.endTime,
            lunchMin: Math.max(0, input.lunchMin || 0)
        }) == null
    )
        return {
            error: 'La salida tiene que ser después de la entrada, con tiempo de trabajo además del almuerzo.'
        };
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
    revalidatePath('/admin/rrhh/planilla');
    return {};
}

// ─── Punch corrections ──────────────────────────────────────────────
// The only way a recorded time changes. Each correction needs a reason
// and is logged in hr_punch_edits by the same DB transaction.

function correctionPinError(pin: string): string | null {
    const expected = process.env.HR_CORRECTION_PIN;
    if (!expected) return 'El PIN de corrección no está configurado.';
    if (typeof pin !== 'string' || !pin || pin.length > 128) return 'PIN incorrecto.';
    const suppliedHash = createHash('sha256').update(pin).digest();
    const expectedHash = createHash('sha256').update(expected).digest();
    return timingSafeEqual(suppliedHash, expectedHash) ? null : 'PIN incorrecto.';
}

export async function verifyPunchCorrectionPinAction(
    pin: string
): Promise<{ error?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };
    const error = correctionPinError(pin);
    return error ? { error } : {};
}

export interface CorrectPunchInput {
    action: PunchEditAction;
    employeeId: string;
    /** CR day being corrected ("YYYY-MM-DD"); new times land on it. */
    date: string;
    punchId?: string;
    punchType?: PunchType;
    /** CR wall-clock "HH:MM". */
    time?: string;
    reason: string;
    pin: string;
}

export async function correctPunchAction(
    input: CorrectPunchInput
): Promise<{ error?: string }> {
    const { error: adminErr, adminId } = await requireAdmin();
    if (adminErr || !adminId) return { error: adminErr || 'No autorizado.' };
    const pinError = correctionPinError(input.pin);
    if (pinError) return { error: pinError };

    const reason = (input.reason || '').trim().slice(0, 300);
    if (!reason) return { error: 'Escribí el motivo de la corrección.' };
    if (!['create', 'update', 'delete'].includes(input.action))
        return { error: 'Acción inválida.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date > crToday())
        return { error: 'Fecha inválida.' };
    if (input.action !== 'create' && !input.punchId)
        return { error: 'Marcaje no encontrado.' };

    let punchedAt: string | null = null;
    let punchType: PunchType | null = null;
    if (input.action !== 'delete') {
        if (!input.punchType || !PUNCH_TYPES.includes(input.punchType))
            return { error: 'Elegí el tipo de marcaje.' };
        const m = /^(\d{2}):(\d{2})$/.exec(input.time || '');
        if (!m || Number(m[1]) > 23 || Number(m[2]) > 59)
            return { error: 'Hora inválida.' };
        punchType = input.punchType;
        punchedAt = crDateTimeToIso(input.date, input.time!);
        if (Date.parse(punchedAt) > Date.now())
            return { error: 'No se puede registrar un marcaje en el futuro.' };
    }

    const service = createServiceClient();
    const employee = await fetchEmployee(service, input.employeeId);
    if (!employee) return { error: 'Empleado no encontrado.' };

    try {
        await correctPunch(service, {
            action: input.action,
            employeeId: input.employeeId,
            punchId: input.punchId || null,
            punchType,
            punchedAt,
            reason,
            editedBy: adminId
        });
    } catch (err) {
        // PostgREST errors are plain objects, not Error instances.
        const msg = (err as { message?: string } | null)?.message || '';
        if (msg.includes('punch not found'))
            return { error: 'Ese marcaje ya no existe. Recargá la página.' };
        return { error: 'No se pudo guardar la corrección. Probá de nuevo.' };
    }

    revalidatePath('/admin/rrhh/asistencia');
    return {};
}

// ─── Time-off requests ──────────────────────────────────────────────

export async function reviewTimeOffAction(
    id: string,
    decision: 'approved' | 'rejected',
    note: string
): Promise<{ error?: string }> {
    const { error: adminErr, adminId } = await requireAdmin();
    if (adminErr || !adminId) return { error: adminErr || 'No autorizado.' };
    if (decision !== 'approved' && decision !== 'rejected') return { error: 'Decisión inválida.' };
    const service = createServiceClient();
    try {
        const ok = await reviewTimeOffRequest(service, id, {
            status: decision,
            adminNote: (note || '').trim().slice(0, 500),
            reviewedBy: adminId
        });
        if (!ok) return { error: 'La solicitud ya no está pendiente (quizá el empleado la canceló).' };
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo guardar la decisión.';
        return { error: msg };
    }
    revalidatePath('/admin/rrhh');
    revalidatePath('/admin/rrhh/permisos');
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
