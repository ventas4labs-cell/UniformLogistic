'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import {
    createQuote,
    updateQuoteFull,
    deleteQuote,
    updateQuoteStatus,
    type QuoteInputHeader,
    type QuoteLineInput,
    type QuoteStatus
} from '@/lib/services/quotes';
import { isAdminEmail } from '@/lib/admin-acting-company';

// Defence in depth: the (admin) layout redirect does NOT protect server
// actions — an action runs and commits before that render pass, and it is
// addressed by action id, so it can be POSTed from any page the caller can
// load. Every mutation re-checks that the caller is the admin.
async function assertAdmin(): Promise<void> {
    const _sb = await createClient();
    const {
        data: { user }
    } = await _sb.auth.getUser();
    if (!user || !isAdminEmail(user.email)) throw new Error('No autorizado.');
}


const REVAL_PATHS = ['/admin/cotizador'];

export async function createQuoteAction(
    header: QuoteInputHeader,
    items: QuoteLineInput[]
): Promise<{ id: string }> {
    await assertAdmin();
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');
    const q = await createQuote(supabase, header, items, user.id);
    for (const p of REVAL_PATHS) revalidatePath(p);
    return { id: q.id };
}

export async function updateQuoteAction(
    id: string,
    header: QuoteInputHeader,
    items: QuoteLineInput[]
) {
    await assertAdmin();
    const supabase = await createClient();
    await updateQuoteFull(supabase, id, header, items);
    for (const p of REVAL_PATHS) revalidatePath(p);
    revalidatePath(`/admin/cotizador/${id}`);
}

export async function updateQuoteStatusAction(id: string, status: QuoteStatus) {
    await assertAdmin();
    const supabase = await createClient();
    await updateQuoteStatus(supabase, id, status);
    for (const p of REVAL_PATHS) revalidatePath(p);
    revalidatePath(`/admin/cotizador/${id}`);
}

export async function deleteQuoteAction(id: string) {
    await assertAdmin();
    const supabase = await createClient();
    await deleteQuote(supabase, id);
    for (const p of REVAL_PATHS) revalidatePath(p);
    redirect('/admin/cotizador');
}
