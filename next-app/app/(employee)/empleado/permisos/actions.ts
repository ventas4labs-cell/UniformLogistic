'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { fetchEmployee } from '@/lib/services/employees';
import { addDaysStr, crToday } from '@/lib/services/hr-punches';
import {
    cancelTimeOffRequest,
    daysInRange,
    hasOverlappingTimeOff,
    insertTimeOffRequest,
    TIME_OFF_KINDS,
    TIME_OFF_MAX_BACKDATE_DAYS as MAX_BACKDATE_DAYS,
    TIME_OFF_MAX_RANGE_DAYS as MAX_RANGE_DAYS,
    type TimeOffKind
} from '@/lib/services/hr-time-off';

const MAX_REASON = 500;

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

async function requireActiveEmployee() {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { error: 'Tu sesión expiró. Iniciá sesión de nuevo.', userId: null };
    const employee = await fetchEmployee(supabase, user.id);
    if (!employee) return { error: 'Tu cuenta no es de empleado.', userId: null };
    if (!employee.isActive)
        return { error: 'Tu cuenta está inactiva. Hablá con el administrador.', userId: null };
    return { error: null, userId: user.id };
}

function revalidate() {
    revalidatePath('/empleado/permisos');
    revalidatePath('/admin/rrhh');
    revalidatePath('/admin/rrhh/permisos');
}

export async function requestTimeOffAction(input: {
    kind: TimeOffKind;
    startDate: string;
    endDate: string;
    reason: string;
}): Promise<{ error?: string }> {
    const { error: authErr, userId } = await requireActiveEmployee();
    if (authErr || !userId) return { error: authErr || 'No autorizado.' };

    if (!TIME_OFF_KINDS.includes(input.kind)) return { error: 'Elegí el tipo de permiso.' };
    if (!isDate(input.startDate) || !isDate(input.endDate))
        return { error: 'Elegí las fechas del permiso.' };
    if (input.endDate < input.startDate)
        return { error: 'La fecha final no puede ser antes de la inicial.' };
    if (input.startDate < addDaysStr(crToday(), -MAX_BACKDATE_DAYS))
        return {
            error: `Solo podés pedir permisos de hasta ${MAX_BACKDATE_DAYS} días atrás. Para fechas más viejas hablá con el administrador.`
        };
    if (daysInRange(input.startDate, input.endDate) > MAX_RANGE_DAYS)
        return { error: `Un permiso puede cubrir como máximo ${MAX_RANGE_DAYS} días.` };

    const reason = (input.reason || '').trim().slice(0, MAX_REASON);

    const service = createServiceClient();
    try {
        if (await hasOverlappingTimeOff(service, userId, input.startDate, input.endDate)) {
            return { error: 'Ya tenés un permiso pendiente o aprobado en esas fechas.' };
        }
        await insertTimeOffRequest(service, {
            employeeId: userId,
            kind: input.kind,
            startDate: input.startDate,
            endDate: input.endDate,
            reason
        });
    } catch {
        return { error: 'No se pudo enviar la solicitud. Probá de nuevo.' };
    }

    revalidate();
    return {};
}

export async function cancelTimeOffAction(id: string): Promise<{ error?: string }> {
    const { error: authErr, userId } = await requireActiveEmployee();
    if (authErr || !userId) return { error: authErr || 'No autorizado.' };

    const service = createServiceClient();
    try {
        const ok = await cancelTimeOffRequest(service, id, userId);
        if (!ok) return { error: 'Esta solicitud ya fue revisada y no se puede cancelar.' };
    } catch {
        return { error: 'No se pudo cancelar. Probá de nuevo.' };
    }

    revalidate();
    return {};
}
