'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { isAdminEmail } from '@/lib/admin-acting-company';
import { buildVoiceCatalog, type VoiceCatalogEntry } from '@/lib/services/voice-catalog';
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

export async function getManualStockCatalogAction(
    companyId: string
): Promise<{ entries: VoiceCatalogEntry[]; error?: string }> {
    await assertAdmin();
    if (!UUID_RE.test(companyId))
        return { entries: [], error: 'Seleccioná una empresa válida.' };

    const supabase = await createClient();
    const { data: company, error } = await supabase
        .from('companies')
        .select('id')
        .eq('id', companyId)
        .maybeSingle();
    if (error || !company)
        return { entries: [], error: 'No se encontró la empresa.' };

    try {
        return { entries: await buildVoiceCatalog(supabase, companyId) };
    } catch {
        return { entries: [], error: 'No se pudo cargar el catálogo de productos.' };
    }
}

export interface ManualStockEntryInput {
    companyId: string;
    productId: string;
    size: string;
    quantity: number;
    reason?: string;
}

/** Add physical pieces to one company's SKU, creating its stock row if needed. */
export async function addManualStockEntryAction(
    input: ManualStockEntryInput
): Promise<{ error?: string }> {
    await assertAdmin();
    if (!UUID_RE.test(input.companyId) || !UUID_RE.test(input.productId))
        return { error: 'Empresa o producto inválido.' };
    if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 1_000_000)
        return { error: 'La cantidad debe ser un número entero entre 1 y 1.000.000.' };
    if (typeof input.size !== 'string' || !input.size)
        return { error: 'Seleccioná una talla válida.' };

    const supabase = await createClient();
    const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('id', input.companyId)
        .maybeSingle();
    if (companyError || !company) return { error: 'No se encontró la empresa.' };

    let catalog: VoiceCatalogEntry[];
    try {
        catalog = await buildVoiceCatalog(supabase, input.companyId);
    } catch {
        return { error: 'No se pudo validar el producto.' };
    }
    if (!catalog.some((entry) => entry.product_id === input.productId && entry.size === input.size))
        return { error: 'El producto o la talla no están disponibles para esta empresa.' };

    const reason =
        typeof input.reason === 'string'
            ? input.reason.trim().slice(0, 200) || 'Entrada manual'
            : 'Entrada manual';
    const { error } = await supabase.rpc('upsert_company_stock_movement', {
        p_company_id: input.companyId,
        p_product_id: input.productId,
        p_size: input.size,
        p_type: 'entry',
        p_quantity: input.quantity,
        p_reason: reason,
        p_source: 'manual'
    });
    if (error) return { error: error.message };

    revalidatePath('/admin/stock');
    revalidatePath('/stock');
    return {};
}

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
