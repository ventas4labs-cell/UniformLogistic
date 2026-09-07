'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { isAdminEmail } from '@/lib/admin-acting-company';

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
): Promise<{ error?: string }> {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.rpc('review_stock_withdrawal', {
        p_id: id,
        p_approve: approve,
        p_note: note?.trim() || null
    });
    if (error) return { error: error.message };

    revalidatePath('/admin/stock');
    revalidatePath('/admin/entregas');
    revalidatePath('/stock');
    return {};
}
