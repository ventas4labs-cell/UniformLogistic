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

export type StockCorrectionMode = 'exit' | 'adjustment';

export interface StockCorrectionInput {
    companyId: string;
    productId: string;
    /** exit = pieces that left the bodega; adjustment = set the real count. */
    mode: StockCorrectionMode;
    lines: { size: string; quantity: number }[];
    reason?: string;
}

export interface StockCorrectionResult {
    error?: string;
    applied: number;
    failed: { size: string; error: string }[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The balance writer raises in English; the admin reads Spanish.
function correctionErrorMessage(raw: string): string {
    const short = raw.match(/insufficient on_hand: have (\d+)/);
    if (short) return `Solo hay ${short[1]} en bodega.`;
    if (raw.includes('reservation would exceed available stock'))
        return 'Hay piezas reservadas por retiros pendientes; no se puede bajar de esa cantidad.';
    return raw;
}

/**
 * Admin correction of a company's stock for one product: book the pieces
 * that already left the bodega, or overwrite each size with the physical
 * count. Every line goes through upsert_company_stock_movement, so the
 * change lands in the stock_movements ledger like any other movement.
 * Lines apply independently — one bad size doesn't block the rest.
 */
export async function correctStockAction(
    input: StockCorrectionInput
): Promise<StockCorrectionResult> {
    await assertAdmin();
    const { companyId, productId, mode } = input;
    if (!UUID_RE.test(companyId) || !UUID_RE.test(productId))
        return { error: 'Producto o empresa inválidos.', applied: 0, failed: [] };
    if (mode !== 'exit' && mode !== 'adjustment')
        return { error: 'Tipo de corrección inválido.', applied: 0, failed: [] };

    const lines = (input.lines || []).filter((l) =>
        mode === 'exit'
            ? Number.isInteger(l.quantity) && l.quantity > 0
            : Number.isInteger(l.quantity) && l.quantity >= 0
    );
    if (lines.length === 0)
        return { error: 'No hay cantidades para aplicar.', applied: 0, failed: [] };

    const supabase = await createClient();

    // Corrections only touch sizes the company already holds — the modal
    // never offers a new size, and a crafted size string must not open a
    // fresh stock row.
    const { data: existing, error: readError } = await supabase
        .from('company_stock')
        .select('size')
        .eq('company_id', companyId)
        .eq('product_id', productId);
    if (readError) return { error: readError.message, applied: 0, failed: [] };
    const known = new Set((existing || []).map((r) => r.size as string));

    const reason =
        input.reason?.trim().slice(0, 200) ||
        (mode === 'exit' ? 'Salida manual' : 'Conteo físico');

    let applied = 0;
    const failed: { size: string; error: string }[] = [];
    for (const line of lines) {
        if (!known.has(line.size)) {
            failed.push({ size: line.size, error: 'Talla sin stock para esta empresa.' });
            continue;
        }
        const { error } = await supabase.rpc('upsert_company_stock_movement', {
            p_company_id: companyId,
            p_product_id: productId,
            p_size: line.size,
            p_type: mode,
            p_quantity: line.quantity,
            p_reason: reason,
            p_source: 'manual'
        });
        if (error) failed.push({ size: line.size, error: correctionErrorMessage(error.message) });
        else applied++;
    }

    if (applied > 0) {
        revalidatePath('/admin/stock');
        revalidatePath('/stock');
    }
    return { applied, failed };
}
