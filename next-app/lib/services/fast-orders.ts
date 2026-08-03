import type { SupabaseClient } from '@supabase/supabase-js';
import type { SizeSelection } from '@/lib/types';

// A single line in a public "Pedido rápido" request: a basic product,
// a chosen size (with its structured selection so it can be turned into
// a real order later), a colour (preset swatch name or free text), and
// a quantity.
export interface FastOrderItem {
    productId: string; // products.id (uuid)
    productCode: string;
    productName: string;
    size: string; // display label, e.g. "Hombre · M"
    color: string; // colour name or free text ("" when none)
    quantity: number;
    selection: SizeSelection;
}

// Contact block the customer fills in before submitting.
export interface FastOrderContact {
    name: string;
    email: string;
    phone: string;
    company: string;
    notes: string;
}

export type FastOrderStatus = 'pending' | 'converted' | 'rejected';

export interface FastOrderRequest {
    id: string;
    requestNumber: number;
    requestRef: string; // SOL-00001
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    companyName: string;
    notes: string;
    status: FastOrderStatus;
    items: FastOrderItem[];
    acceptedOrderId: string | null;
    createdAt: string;
}

export const formatFastOrderRef = (n: number): string =>
    `SOL-${String(n).padStart(5, '0')}`;

const REQUEST_SELECT =
    'id, request_number, contact_name, contact_email, contact_phone, company_name, notes, status, items, accepted_order_id, created_at';

interface RequestRow {
    id: string;
    request_number: number;
    contact_name: string;
    contact_email: string | null;
    contact_phone: string | null;
    company_name: string | null;
    notes: string | null;
    status: FastOrderStatus;
    items: FastOrderItem[] | null;
    accepted_order_id: string | null;
    created_at: string;
}

const mapRow = (r: RequestRow): FastOrderRequest => ({
    id: r.id,
    requestNumber: r.request_number,
    requestRef: formatFastOrderRef(r.request_number),
    contactName: r.contact_name,
    contactEmail: r.contact_email || '',
    contactPhone: r.contact_phone || '',
    companyName: r.company_name || '',
    notes: r.notes || '',
    status: r.status,
    items: Array.isArray(r.items) ? r.items : [],
    acceptedOrderId: r.accepted_order_id,
    createdAt: r.created_at
});

export const fetchFastOrderRequests = async (
    supabase: SupabaseClient
): Promise<FastOrderRequest[]> => {
    const { data, error } = await supabase
        .from('order_requests')
        .select(REQUEST_SELECT)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as RequestRow[]).map(mapRow);
};

export const fetchFastOrderRequest = async (
    supabase: SupabaseClient,
    id: string
): Promise<FastOrderRequest | null> => {
    const { data, error } = await supabase
        .from('order_requests')
        .select(REQUEST_SELECT)
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data as RequestRow) : null;
};

export const createFastOrderRequest = async (
    supabase: SupabaseClient,
    contact: FastOrderContact,
    items: FastOrderItem[]
): Promise<FastOrderRequest> => {
    const { data, error } = await supabase
        .from('order_requests')
        .insert({
            contact_name: contact.name,
            contact_email: contact.email || null,
            contact_phone: contact.phone || null,
            company_name: contact.company || null,
            notes: contact.notes || null,
            status: 'pending' as FastOrderStatus,
            items
        })
        .select(REQUEST_SELECT)
        .single();
    if (error) throw error;
    return mapRow(data as RequestRow);
};

export const updateFastOrderRequestStatus = async (
    supabase: SupabaseClient,
    id: string,
    status: FastOrderStatus,
    acceptedOrderId?: string
): Promise<void> => {
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (acceptedOrderId) patch.accepted_order_id = acceptedOrderId;
    const { error } = await supabase.from('order_requests').update(patch).eq('id', id);
    if (error) throw error;
};

// Public fast-orders have no empresa. On accept we attach the created
// order to a single house company ("Pedidos Web") so it flows through
// the existing company-scoped boards; the real contact details live in
// the order notes. document_number is UNIQUE and NOT NULL, so we key the
// singleton off a sentinel value.
const WEB_COMPANY_DOC = 'PEDIDOS-WEB';

export const ensureWebCompany = async (
    supabase: SupabaseClient
): Promise<string> => {
    const { data: existing, error: findErr } = await supabase
        .from('companies')
        .select('id')
        .eq('document_number', WEB_COMPANY_DOC)
        .maybeSingle();
    if (findErr) throw findErr;
    if (existing?.id) return existing.id as string;

    const { data, error } = await supabase
        .from('companies')
        .insert({
            name: 'Pedidos Web',
            document_number: WEB_COMPANY_DOC,
            contact_name: 'Pedidos rápidos (web)',
            is_active: true
        })
        .select('id')
        .single();
    if (error) throw error;
    return data.id as string;
};
