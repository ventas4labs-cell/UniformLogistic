'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

// Client-facing retiro actions. Authorization lives inside the RPCs: they
// resolve the caller's company from company_users, so a client can only
// ever touch their own stock — the action layer never picks the company.

export interface WithdrawalLineInput {
    productId: string;
    size: string;
    quantity: number;
}

export async function requestWithdrawalAction(
    lines: WithdrawalLineInput[],
    recipient: string,
    notes: string,
    wantsDelivery: boolean
): Promise<{ error?: string; ref?: string; pieces?: number }> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { error: 'Tu sesión expiró. Iniciá sesión de nuevo.' };

    const clean = lines
        .map((l) => ({ ...l, quantity: Math.round(l.quantity) }))
        .filter((l) => l.productId && l.size && Number.isFinite(l.quantity) && l.quantity > 0);
    if (clean.length === 0) return { error: 'Agregá al menos una pieza al retiro.' };

    const { data, error } = await supabase.rpc('request_stock_withdrawal', {
        p_lines: clean.map((l) => ({
            product_id: l.productId,
            size: l.size,
            quantity: l.quantity
        })),
        p_recipient: recipient.trim() || null,
        p_notes: notes.trim() || null,
        p_wants_delivery: wantsDelivery
    });
    if (error) return { error: error.message };

    revalidatePath('/stock');
    revalidatePath('/admin/stock');
    const res = data as { number?: number; pieces?: number } | null;
    return {
        ref: res?.number ? `RETIRO-${String(res.number).padStart(5, '0')}` : undefined,
        pieces: res?.pieces
    };
}

export async function cancelWithdrawalAction(
    id: string
): Promise<{ error?: string }> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { error: 'Tu sesión expiró. Iniciá sesión de nuevo.' };

    const { error } = await supabase.rpc('cancel_stock_withdrawal', { p_id: id });
    if (error) return { error: error.message };

    revalidatePath('/stock');
    revalidatePath('/admin/stock');
    return {};
}
