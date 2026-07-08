import type { SupabaseClient } from '@supabase/supabase-js';

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
export type QuoteSource = 'admin' | 'customer';

export const QUOTE_STATUS_OPTIONS: { value: QuoteStatus; label: string; color: string }[] = [
    { value: 'draft', label: 'Borrador', color: 'bg-gray-100 text-gray-800' },
    { value: 'sent', label: 'Enviada', color: 'bg-blue-100 text-blue-800' },
    { value: 'accepted', label: 'Aceptada', color: 'bg-green-100 text-green-800' },
    { value: 'rejected', label: 'Rechazada', color: 'bg-red-100 text-red-800' },
    { value: 'expired', label: 'Vencida', color: 'bg-amber-100 text-amber-800' }
];

export const formatQuoteRef = (n: number) => `COT-${String(n).padStart(5, '0')}`;

export interface QuoteLine {
    id: string;
    catalogItemId: string | null;
    name: string;
    description: string;
    imageUrl: string;
    fabricType: string;
    color: string;
    unitPrice: number;
    pricePerLogo: number;
    quantity: number;
    logoCount: number;
    sortOrder: number;
}

export interface Quote {
    id: string;
    quoteNumber: number;
    quoteRef: string;
    status: QuoteStatus;
    source: QuoteSource;
    clientName: string;
    companyName: string;
    contactEmail: string;
    contactPhone: string;
    quoteDate: string;
    validUntil: string | null;
    notes: string;
    discountPct: number;
    taxPct: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
    items: QuoteLine[];
}

export interface QuoteSummary {
    id: string;
    quoteNumber: number;
    quoteRef: string;
    status: QuoteStatus;
    source: QuoteSource;
    clientName: string;
    companyName: string;
    quoteDate: string;
    validUntil: string | null;
    lineCount: number;
    totalPieces: number;
    subtotal: number;
    total: number;
    currency: string;
    createdAt: string;
}

export interface QuoteInputHeader {
    status?: QuoteStatus;
    source?: QuoteSource;
    clientName?: string;
    companyName?: string;
    contactEmail?: string;
    contactPhone?: string;
    quoteDate?: string;
    validUntil?: string | null;
    notes?: string;
    discountPct?: number;
    taxPct?: number;
    currency?: string;
}

export interface QuoteLineInput {
    catalogItemId?: string | null;
    name: string;
    description?: string;
    imageUrl?: string;
    fabricType?: string;
    color?: string;
    unitPrice: number;
    pricePerLogo?: number;
    quantity: number;
    logoCount?: number;
    sortOrder?: number;
}

interface RawQuoteRow {
    id: string;
    quote_number: number;
    status: string;
    source: string | null;
    client_name: string | null;
    company_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    quote_date: string;
    valid_until: string | null;
    notes: string | null;
    discount_pct: number | string;
    tax_pct: number | string;
    currency: string;
    created_at: string;
    updated_at: string;
    items?: RawQuoteItemRow[] | null;
}

interface RawQuoteItemRow {
    id: string;
    catalog_item_id: string | null;
    name: string;
    description: string | null;
    image_url: string | null;
    fabric_type: string | null;
    color: string | null;
    unit_price: number | string;
    price_per_logo: number | string | null;
    quantity: number;
    logo_count: number;
    sort_order: number;
}

const num = (n: number | string | null | undefined): number => {
    if (n === null || n === undefined) return 0;
    return typeof n === 'string' ? parseFloat(n) : n;
};

const mapLine = (r: RawQuoteItemRow): QuoteLine => ({
    id: r.id,
    catalogItemId: r.catalog_item_id,
    name: r.name,
    description: r.description || '',
    imageUrl: r.image_url || '',
    fabricType: r.fabric_type || '',
    color: r.color || '',
    unitPrice: num(r.unit_price),
    pricePerLogo: num(r.price_per_logo),
    quantity: r.quantity,
    logoCount: r.logo_count,
    sortOrder: r.sort_order
});

const asSource = (s: string | null): QuoteSource =>
    s === 'customer' ? 'customer' : 'admin';

const mapQuote = (r: RawQuoteRow): Quote => ({
    id: r.id,
    quoteNumber: r.quote_number,
    quoteRef: formatQuoteRef(r.quote_number),
    status: r.status as QuoteStatus,
    source: asSource(r.source),
    clientName: r.client_name || '',
    companyName: r.company_name || '',
    contactEmail: r.contact_email || '',
    contactPhone: r.contact_phone || '',
    quoteDate: r.quote_date,
    validUntil: r.valid_until,
    notes: r.notes || '',
    discountPct: num(r.discount_pct),
    taxPct: num(r.tax_pct),
    currency: r.currency,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    items: (r.items || []).slice().sort((a, b) => a.sort_order - b.sort_order).map(mapLine)
});

// One line's money: base price plus per-logo charge, times quantity.
// Shared so admin UI, the public configurator, and the PDF agree.
export function lineSubtotal(i: {
    unitPrice: number;
    quantity: number;
    logoCount?: number;
    pricePerLogo?: number;
}): number {
    const perUnit = i.unitPrice + (i.pricePerLogo ?? 0) * (i.logoCount ?? 0);
    return perUnit * i.quantity;
}

// Pricing math kept in one place so admin UI, PDF and the customer
// configurator can agree on the same rounding rules.
export function computeQuoteTotals(q: {
    items: { unitPrice: number; quantity: number; logoCount?: number; pricePerLogo?: number }[];
    discountPct: number;
    taxPct: number;
}): { subtotal: number; discount: number; taxable: number; tax: number; total: number } {
    const subtotal = q.items.reduce((s, i) => s + lineSubtotal(i), 0);
    const discount = subtotal * (q.discountPct / 100);
    const taxable = subtotal - discount;
    const tax = taxable * (q.taxPct / 100);
    const total = taxable + tax;
    return { subtotal, discount, taxable, tax, total };
}

const QUOTE_SELECT = `
    id, quote_number, status, source, client_name, company_name, contact_email,
    contact_phone, quote_date, valid_until, notes, discount_pct, tax_pct,
    currency, created_at, updated_at,
    items:quote_items (
        id, catalog_item_id, name, description, image_url, fabric_type, color,
        unit_price, price_per_logo, quantity, logo_count, sort_order
    )
`;

// Row payload shared by create + update so the column list can't drift.
const toItemRow = (quoteId: string, it: QuoteLineInput, idx: number) => ({
    quote_id: quoteId,
    catalog_item_id: it.catalogItemId ?? null,
    name: it.name,
    description: it.description ?? null,
    image_url: it.imageUrl ?? null,
    fabric_type: it.fabricType ?? null,
    color: it.color ?? null,
    unit_price: it.unitPrice,
    price_per_logo: it.pricePerLogo ?? 0,
    quantity: it.quantity,
    logo_count: it.logoCount ?? 0,
    sort_order: it.sortOrder ?? idx
});

const toHeaderRow = (header: QuoteInputHeader) => ({
    status: header.status ?? 'draft',
    source: header.source ?? 'admin',
    client_name: header.clientName ?? null,
    company_name: header.companyName ?? null,
    contact_email: header.contactEmail ?? null,
    contact_phone: header.contactPhone ?? null,
    quote_date: header.quoteDate ?? new Date().toISOString().slice(0, 10),
    valid_until: header.validUntil ?? null,
    notes: header.notes ?? null,
    discount_pct: header.discountPct ?? 0,
    tax_pct: header.taxPct ?? 13,
    currency: header.currency ?? 'CRC'
});

export async function fetchQuotes(
    supabase: SupabaseClient
): Promise<QuoteSummary[]> {
    const { data, error } = await supabase
        .from('quotes')
        .select(QUOTE_SELECT)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data || []) as unknown as RawQuoteRow[]).map((r) => {
        const items = (r.items || []).map(mapLine);
        const totals = computeQuoteTotals({
            items,
            discountPct: num(r.discount_pct),
            taxPct: num(r.tax_pct)
        });
        return {
            id: r.id,
            quoteNumber: r.quote_number,
            quoteRef: formatQuoteRef(r.quote_number),
            status: r.status as QuoteStatus,
            source: asSource(r.source),
            clientName: r.client_name || '',
            companyName: r.company_name || '',
            quoteDate: r.quote_date,
            validUntil: r.valid_until,
            lineCount: items.length,
            totalPieces: items.reduce((s, i) => s + i.quantity, 0),
            subtotal: totals.subtotal,
            total: totals.total,
            currency: r.currency,
            createdAt: r.created_at
        };
    });
}

export async function fetchQuote(
    supabase: SupabaseClient,
    id: string
): Promise<Quote | null> {
    const { data, error } = await supabase
        .from('quotes')
        .select(QUOTE_SELECT)
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return mapQuote(data as unknown as RawQuoteRow);
}

export async function createQuote(
    supabase: SupabaseClient,
    header: QuoteInputHeader,
    items: QuoteLineInput[],
    createdBy: string | null
): Promise<Quote> {
    const { data: created, error: qErr } = await supabase
        .from('quotes')
        .insert({ ...toHeaderRow(header), created_by: createdBy })
        .select('id')
        .single();
    if (qErr) throw qErr;

    if (items.length > 0) {
        const rows = items.map((it, idx) => toItemRow(created.id, it, idx));
        const { error: iErr } = await supabase.from('quote_items').insert(rows);
        if (iErr) {
            // Roll back the header if items failed so we don't leave a
            // "COT-XXXXX with 0 lines" ghost row. Mirrors createOrder.
            await supabase.from('quotes').delete().eq('id', created.id);
            throw iErr;
        }
    }

    const full = await fetchQuote(supabase, created.id);
    if (!full) throw new Error('Failed to load created quote');
    return full;
}

export async function updateQuoteFull(
    supabase: SupabaseClient,
    id: string,
    header: QuoteInputHeader,
    items: QuoteLineInput[]
): Promise<void> {
    const { error: hErr } = await supabase
        .from('quotes')
        .update(toHeaderRow(header))
        .eq('id', id);
    if (hErr) throw hErr;

    // Simplest reconcile: wipe items and re-insert. Quote items have no
    // downstream FK dependencies so there's nothing to preserve.
    const { error: dErr } = await supabase
        .from('quote_items')
        .delete()
        .eq('quote_id', id);
    if (dErr) throw dErr;

    if (items.length > 0) {
        const rows = items.map((it, idx) => toItemRow(id, it, idx));
        const { error: iErr } = await supabase.from('quote_items').insert(rows);
        if (iErr) throw iErr;
    }
}

export async function deleteQuote(
    supabase: SupabaseClient,
    id: string
): Promise<void> {
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) throw error;
}

export async function updateQuoteStatus(
    supabase: SupabaseClient,
    id: string,
    status: QuoteStatus
): Promise<void> {
    const { error } = await supabase.from('quotes').update({ status }).eq('id', id);
    if (error) throw error;
}
