'use server';

import { createClient, createServiceClient } from '@/utils/supabase/server';
import { fetchEmployee } from '@/lib/services/employees';
import {
    claimPunchToken,
    fetchPunchToken,
    releasePunchToken
} from '@/lib/services/hr-kiosks';
import {
    deriveState,
    fetchTodayPunches,
    insertPunch,
    isValidTransition,
    lastPunchType,
    PUNCH_LABELS,
    type PunchState,
    type PunchType
} from '@/lib/services/hr-punches';

/**
 * Record a punch. Runs as the logged-in employee. The QR token proves
 * physical presence (must be unexpired); the state machine rejects
 * illegal transitions (e.g. two entradas in a row).
 */
export async function recordPunchAction(
    token: string,
    punchType: PunchType
): Promise<{ error?: string; ok?: boolean; message?: string; state?: PunchState; punchedAt?: string }> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { error: 'Tu sesión expiró. Iniciá sesión de nuevo.' };

    const employee = await fetchEmployee(supabase, user.id);
    if (!employee) return { error: 'Tu cuenta no es de empleado.' };
    if (!employee.isActive) return { error: 'Tu cuenta está inactiva. Hablá con el administrador.' };

    const service = createServiceClient();
    const pt = await fetchPunchToken(service, token);
    if (!pt) return { error: 'Código inválido. Escaneá el QR del taller de nuevo.' };
    if (pt.expired) return { error: 'El código venció. Escaneá el QR del taller de nuevo.' };

    // Validate the transition against today's punches.
    const punches = await fetchTodayPunches(supabase, user.id);
    const state = deriveState(lastPunchType(punches));
    if (!isValidTransition(state, punchType)) {
        return {
            error: 'Esa acción no corresponde a tu estado actual. Recargá la página e intentá de nuevo.'
        };
    }

    // Every punch needs its own scan: spend the code for this employee
    // BEFORE writing the punch. The composite PK makes this atomic, so a
    // double-tap or a second tab can't slip a second punch through on
    // one scan.
    const claimed = await claimPunchToken(service, pt.id, user.id);
    if (!claimed) {
        return {
            error: 'Ya usaste este código. Escaneá el código nuevo de la pantalla para volver a marcar.'
        };
    }

    let punchedAt: string;
    try {
        const punch = await insertPunch(service, {
            employeeId: user.id,
            punchType,
            qrTokenId: pt.id
        });
        punchedAt = punch.punchedAt;
    } catch {
        // Give the scan back so a transient failure doesn't burn it.
        await releasePunchToken(service, pt.id, user.id);
        return { error: 'No se pudo registrar el marcaje. Probá de nuevo.' };
    }

    return {
        ok: true,
        message: `${PUNCH_LABELS[punchType]} registrada`,
        state: deriveState(punchType),
        punchedAt
    };
}
