import type { SupabaseClient } from '@supabase/supabase-js';

export type InvoiceStatus =
    | 'draft'
    | 'pending'
    | 'partially_paid'
    | 'paid'
    | 'overdue'
    | 'cancelled';

export interface InvoiceRow {
    id: string;
    invoiceNumber: string;
    orderId: string | null;
    orderRef: string | null;
    issuedDate: string;
    dueDate: string;
    subtotal: number;
    ivaAmount: number;
    total: number;
    paidAmount: number;
    balance: number;
    status: InvoiceStatus;
    /** True when status='pending' but due_date < today (computed). */
    isOverdueByDate: boolean;
    daysOverdue: number;
    notes: string | null;
}

interface RawOrder {
    id: string;
    order_number: number;
}
interface RawInvoiceRow {
    id: string;
    invoice_number: string;
    order_id: string | null;
    issued_date: string;
    due_date: string;
    subtotal: string | number;
    iva_amount: string | number;
    total: string | number;
    paid_amount: string | number;
    status: InvoiceStatus;
    notes: string | null;
    order: RawOrder | RawOrder[] | null;
}

const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    !v ? null : Array.isArray(v) ? (v[0] ?? null) : v;

const formatOrderRef = (n: number) => `ORDEN-${String(n).padStart(5, '0')}`;

const mapInvoice = (r: RawInvoiceRow): InvoiceRow => {
    const order = pickOne(r.order);
    const total = Number(r.total ?? 0);
    const paid = Number(r.paid_amount ?? 0);
    const balance = Math.max(0, total - paid);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(r.due_date);
    due.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 3600 * 1000;
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / msPerDay));
    const isOverdueByDate =
        balance > 0 && due < today && r.status !== 'paid' && r.status !== 'cancelled';

    return {
        id: r.id,
        invoiceNumber: r.invoice_number,
        orderId: r.order_id,
        orderRef: order ? formatOrderRef(order.order_number) : null,
        issuedDate: r.issued_date,
        dueDate: r.due_date,
        subtotal: Number(r.subtotal ?? 0),
        ivaAmount: Number(r.iva_amount ?? 0),
        total,
        paidAmount: paid,
        balance,
        status: r.status,
        isOverdueByDate,
        daysOverdue,
        notes: r.notes
    };
};

const SELECT = `
    id, invoice_number, order_id, issued_date, due_date,
    subtotal, iva_amount, total, paid_amount, status, notes,
    order:orders ( id, order_number )
`;

export const fetchInvoicesForUser = async (
    supabase: SupabaseClient,
    userId: string
): Promise<InvoiceRow[]> => {
    const { data: link, error: linkErr } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();
    if (linkErr) throw linkErr;
    if (!link?.company_id) return [];

    const { data, error } = await supabase
        .from('invoices')
        .select(SELECT)
        .eq('company_id', link.company_id)
        .order('issued_date', { ascending: false });
    if (error) throw error;

    return ((data || []) as unknown as RawInvoiceRow[]).map(mapInvoice);
};

export interface InvoiceSummary {
    totalInvoices: number;
    pending: number;
    overdue: number;
    paid: number;
    totalBalance: number;
    overdueBalance: number;
    nextDueDate: string | null;
}

/**
 * Admin: invoices across ALL companies, grouped per company. Server-only.
 */
export interface CompanyInvoiceGroup {
    company: { id: string; name: string };
    invoices: InvoiceRow[];
    summary: InvoiceSummary;
}

export const fetchAllInvoicesGroupedByCompany = async (
    supabase: SupabaseClient
): Promise<CompanyInvoiceGroup[]> => {
    const { data, error } = await supabase
        .from('invoices')
        .select(
            `
            id, invoice_number, order_id, issued_date, due_date,
            subtotal, iva_amount, total, paid_amount, status, notes,
            company_id,
            company:companies ( id, name ),
            order:orders ( id, order_number )
        `
        )
        .order('issued_date', { ascending: false });
    if (error) throw error;

    interface RawAdminInvoiceRow extends RawInvoiceRow {
        company_id: string;
        company: { id: string; name: string } | { id: string; name: string }[] | null;
    }

    const groups = new Map<string, CompanyInvoiceGroup>();
    ((data || []) as unknown as RawAdminInvoiceRow[]).forEach((r) => {
        const c = pickOne(r.company);
        if (!c) return;
        const inv = mapInvoice(r);
        const group: CompanyInvoiceGroup = groups.get(c.id) || {
            company: { id: c.id, name: c.name },
            invoices: [],
            summary: {
                totalInvoices: 0,
                pending: 0,
                overdue: 0,
                paid: 0,
                totalBalance: 0,
                overdueBalance: 0,
                nextDueDate: null
            }
        };
        group.invoices.push(inv);
        groups.set(c.id, group);
    });

    groups.forEach((g) => {
        g.summary = summarizeInvoices(g.invoices);
    });

    // Sort: overdue balance desc, then total balance desc, then name
    return Array.from(groups.values()).sort((a, b) => {
        if (b.summary.overdueBalance !== a.summary.overdueBalance)
            return b.summary.overdueBalance - a.summary.overdueBalance;
        if (b.summary.totalBalance !== a.summary.totalBalance)
            return b.summary.totalBalance - a.summary.totalBalance;
        return a.company.name.localeCompare(b.company.name, 'es');
    });
};

/**
 * After a successful Hacienda emission, link the fe_documento to an
 * invoices row so the customer-facing /cuentas dashboard reflects the
 * receivable. Creates a new invoice when none exists for the order.
 *
 * Returns the resulting invoice id (or null if linking was skipped because
 * the document is not a factura/nc/nd type or no order is attached).
 */
export const linkFeDocumentoToInvoice = async (
    supabase: SupabaseClient,
    params: {
        feDocumentoId: string;
        orderId: string | null;
        companyId: string;
        total: number;
        ivaAmount: number;
        subtotal: number;
        tipoDocumento: string; // '01'|'02'|'03'|'04'|'08'|'10'
        consecutivo: string;
        paymentTermDays?: number; // default 30
    }
): Promise<string | null> => {
    // Only Factura (01), Nota Débito (02), Nota Crédito (03), Tiquete (04),
    // Factura Compra (08) create/affect receivables. MensajeReceptor (10) does not.
    if (!['01', '02', '03', '04', '08'].includes(params.tipoDocumento)) {
        return null;
    }
    if (!params.orderId) {
        // We could still create a standalone invoice, but for now require an order.
        return null;
    }
    const dueDays = params.paymentTermDays ?? 30;
    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + dueDays);
    const isoToday = today.toISOString().slice(0, 10);
    const isoDue = due.toISOString().slice(0, 10);

    // Existing invoice for this order?
    const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('order_id', params.orderId)
        .maybeSingle();

    // Nota Crédito reduces the receivable: we record it as a separate
    // invoice with negative total OR mark the original as paid/cancelled.
    // For now, simplest: create a separate row with negative total, fe-linked.
    if (params.tipoDocumento === '03') {
        const { data, error } = await supabase
            .from('invoices')
            .insert({
                invoice_number: `NC-${params.consecutivo.slice(-10)}`,
                company_id: params.companyId,
                order_id: params.orderId,
                fe_documento_id: params.feDocumentoId,
                issued_date: isoToday,
                due_date: isoDue,
                subtotal: -Math.abs(params.subtotal),
                iva_amount: -Math.abs(params.ivaAmount),
                total: -Math.abs(params.total),
                paid_amount: 0,
                status: 'pending',
                notes: `Nota crédito ${params.consecutivo}`
            })
            .select('id')
            .single();
        if (error) throw error;
        return data!.id;
    }

    if (existing) {
        // Update the existing row to attach the FE document. Totals are
        // recomputed from Hacienda's response (the source of truth).
        const { data, error } = await supabase
            .from('invoices')
            .update({
                fe_documento_id: params.feDocumentoId,
                subtotal: params.subtotal,
                iva_amount: params.ivaAmount,
                total: params.total,
                issued_date: isoToday,
                due_date: isoDue
            })
            .eq('id', existing.id)
            .select('id')
            .single();
        if (error) throw error;
        return data!.id;
    }

    // First emission for this order → create the invoice.
    const invoiceNumber = `INV-${params.consecutivo.slice(-10)}`;
    const { data, error } = await supabase
        .from('invoices')
        .insert({
            invoice_number: invoiceNumber,
            company_id: params.companyId,
            order_id: params.orderId,
            fe_documento_id: params.feDocumentoId,
            issued_date: isoToday,
            due_date: isoDue,
            subtotal: params.subtotal,
            iva_amount: params.ivaAmount,
            total: params.total,
            paid_amount: 0,
            status: 'pending'
        })
        .select('id')
        .single();
    if (error) throw error;
    return data!.id;
};

export const summarizeInvoices = (rows: InvoiceRow[]): InvoiceSummary => {
    let pending = 0;
    let overdue = 0;
    let paid = 0;
    let totalBalance = 0;
    let overdueBalance = 0;
    let nextDueDate: string | null = null;
    rows.forEach((r) => {
        if (r.status === 'paid') paid += 1;
        else if (r.status === 'overdue' || r.isOverdueByDate) {
            overdue += 1;
            overdueBalance += r.balance;
            totalBalance += r.balance;
        } else if (r.status === 'pending' || r.status === 'partially_paid') {
            pending += 1;
            totalBalance += r.balance;
            if (!nextDueDate || r.dueDate < nextDueDate) nextDueDate = r.dueDate;
        }
    });
    return {
        totalInvoices: rows.length,
        pending,
        overdue,
        paid,
        totalBalance,
        overdueBalance,
        nextDueDate
    };
};
