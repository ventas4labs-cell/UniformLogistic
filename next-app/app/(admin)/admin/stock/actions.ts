'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { isAdminEmail } from '@/lib/admin-acting-company';
import {
    sendWithdrawalApprovedEmail,
    sendWithdrawalRejectedEmail
} from '@/lib/email/notifications';

// Defence in depth: the (admin) layout redirect does NOT protect server
// actions — an action runs and commits before that render pass, and it is
// addressed by action id, so it can be POSTed from any page the caller can
// load. The RPC re-checks too, but the check belongs here as well.
async function assertAdmin(): Promise<void> {
    const _sb = await createClient();
    const {
        data: { user }
    } = await _sb.auth.getUser();
    if (!user || !isAdminEmail(user.email)) throw new Error('No autorizado.');
}

/**
 * Approve or reject a retiro. Approving releases the reservation the
 * request made and books the exit; rejecting only releases it. Both happen
 * inside review_stock_withdrawal so the balance can't drift.
 */
export async function reviewWithdrawalAction(
    id: string,
    approve: boolean,
    note?: string
): Promise<{ error?: string; warning?: string }> {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.rpc('review_stock_withdrawal', {
        p_id: id,
        p_approve: approve,
        p_note: note?.trim() || null
    });
    if (error) return { error: error.message };

    // Tell the client the pieces came off their inventory. Best-effort —
    // the stock has already moved, so a failed send must not fail the call.
    // It IS reported though: silently not notifying the client is how you
    // end up with someone waiting on an email that never existed.
    let warning: string | undefined;
    const mail = approve
        ? await sendWithdrawalApprovedEmail(supabase, id)
        : await sendWithdrawalRejectedEmail(supabase, id);
    if (!mail.sent) {
        warning = `Retiro ${approve ? 'aprobado' : 'rechazado'}, pero no se avisó al cliente por correo (${mail.reason}).`;
    }

    revalidatePath('/admin/stock');
    revalidatePath('/admin/entregas');
    revalidatePath('/stock');
    return warning ? { warning } : {};
}
