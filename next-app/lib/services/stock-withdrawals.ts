import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Retiros: the client stock consumption path ─────────────────────
// A client requests pieces from their own stock; the pieces are RESERVED
// immediately (so the same units can't be promised twice) and the admin
// approves, which releases the reserve and books the exit. All balance
// changes happen inside the RPCs — never from here — so the reserve and
// the ledger rows always land in one transaction.

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    cancelled: 'Cancelado'
};

export interface WithdrawalLine {
    id: string;
    productId: string;
    productName: string;
    size: string;
    quantity: number;
}

export interface Withdrawal {
    id: string;
    ref: string;
    companyId: string;
    companyName: string;
    status: WithdrawalStatus;
    requestedAt: string;
    recipientName: string;
    notes: string;
    wantsDelivery: boolean;
    reviewedAt: string | null;
    reviewNote: string;
    scheduledDate: string | null;
    notifiedAt: string | null;
    deliveredAt: string | null;
    lines: WithdrawalLine[];
    totalPieces: number;
}

export const withdrawalRef = (n: number): string =>
    `RETIRO-${String(n).padStart(5, '0')}`;

interface RawLine {
    id: string;
    product_id: string;
    size: string;
    quantity: number;
    product: { name: string } | { name: string }[] | null;
}

interface RawWithdrawal {
    id: string;
    withdrawal_number: number;
    company_id: string;
    status: WithdrawalStatus;
    requested_at: string;
    recipient_name: string | null;
    notes: string | null;
    wants_delivery: boolean;
    reviewed_at: string | null;
    review_note: string | null;
    scheduled_date: string | null;
    notified_at: string | null;
    delivered_at: string | null;
    company: { name: string } | { name: string }[] | null;
    items: RawLine[] | null;
}

const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    !v ? null : Array.isArray(v) ? (v[0] ?? null) : v;

const SELECT =
    'id, withdrawal_number, company_id, status, requested_at, recipient_name, notes, wants_delivery, reviewed_at, review_note, scheduled_date, notified_at, delivered_at, company:companies(name), items:stock_withdrawal_items(id, product_id, size, quantity, product:products(name))';

const mapRow = (r: RawWithdrawal): Withdrawal => {
    const lines = (r.items || []).map((l) => ({
        id: l.id,
        productId: l.product_id,
        productName: pickOne(l.product)?.name || '—',
        size: l.size,
        quantity: l.quantity
    }));
    return {
        id: r.id,
        ref: withdrawalRef(r.withdrawal_number),
        companyId: r.company_id,
        companyName: pickOne(r.company)?.name || '',
        status: r.status,
        requestedAt: r.requested_at,
        recipientName: r.recipient_name || '',
        notes: r.notes || '',
        wantsDelivery: r.wants_delivery,
        reviewedAt: r.reviewed_at,
        reviewNote: r.review_note || '',
        scheduledDate: r.scheduled_date,
        notifiedAt: r.notified_at,
        deliveredAt: r.delivered_at,
        lines,
        totalPieces: lines.reduce((s, l) => s + l.quantity, 0)
    };
};

/** Every retiro the caller may see. RLS scopes it: a client gets their own
 *  company's, the admin gets all. Missing table (pre-migration) → []. */
export async function fetchWithdrawals(
    supabase: SupabaseClient
): Promise<Withdrawal[]> {
    const { data, error } = await supabase
        .from('stock_withdrawals')
        .select(SELECT)
        .order('requested_at', { ascending: false });
    if (error) {
        if ((error as { code?: string }).code === '42P01') return [];
        throw error;
    }
    return ((data || []) as unknown as RawWithdrawal[]).map(mapRow);
}

/** Approved retiros the client asked to have delivered — these join the
 *  courier board alongside order deliveries. */
export async function fetchDeliverableWithdrawals(
    supabase: SupabaseClient
): Promise<Withdrawal[]> {
    const { data, error } = await supabase
        .from('stock_withdrawals')
        .select(SELECT)
        .eq('status', 'approved')
        .eq('wants_delivery', true)
        .order('reviewed_at', { ascending: false });
    if (error) {
        if ((error as { code?: string }).code === '42P01') return [];
        throw error;
    }
    return ((data || []) as unknown as RawWithdrawal[]).map(mapRow);
}
