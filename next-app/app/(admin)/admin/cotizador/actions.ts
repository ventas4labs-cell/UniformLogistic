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

const REVAL_PATHS = ['/admin/cotizador'];

export async function createQuoteAction(
    header: QuoteInputHeader,
    items: QuoteLineInput[]
): Promise<{ id: string }> {
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
    const supabase = await createClient();
    await updateQuoteFull(supabase, id, header, items);
    for (const p of REVAL_PATHS) revalidatePath(p);
    revalidatePath(`/admin/cotizador/${id}`);
}

export async function updateQuoteStatusAction(id: string, status: QuoteStatus) {
    const supabase = await createClient();
    await updateQuoteStatus(supabase, id, status);
    for (const p of REVAL_PATHS) revalidatePath(p);
    revalidatePath(`/admin/cotizador/${id}`);
}

export async function deleteQuoteAction(id: string) {
    const supabase = await createClient();
    await deleteQuote(supabase, id);
    for (const p of REVAL_PATHS) revalidatePath(p);
    redirect('/admin/cotizador');
}
