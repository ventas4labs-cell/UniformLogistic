import type { SupabaseClient } from '@supabase/supabase-js';

export interface DeletedOrderItemSnapshot {
    product_code: string;
    product_name: string;
    size: string;
    quantity: number;
}

export interface DeletedOrderHistoryEntry {
    id: string;
    orderUuid: string;
    orderNumber: number;
    orderRef: string;
    companyName: string | null;
    contactName: string | null;
    purchaseOrder: string | null;
    status: string | null;
    estimatedDeliveryDate: string | null;
    notes: string | null;
    totalItems: number;
    totalPieces: number;
    items: DeletedOrderItemSnapshot[];
    originalCreatedAt: string | null;
    deletedAt: string;
    deletedByEmail: string | null;
}

interface RawRow {
    id: string;
    order_uuid: string;
    order_number: number;
    company_name: string | null;
    contact_name: string | null;
    purchase_order: string | null;
    status: string | null;
    estimated_delivery_date: string | null;
    notes: string | null;
    total_items: number;
    total_pieces: number;
    items_snapshot: DeletedOrderItemSnapshot[] | null;
    original_created_at: string | null;
    deleted_at: string;
    deleted_by_email: string | null;
}

const formatOrderRef = (n: number) => `ORDEN-${String(n).padStart(5, '0')}`;

const mapRow = (row: RawRow): DeletedOrderHistoryEntry => ({
    id: row.id,
    orderUuid: row.order_uuid,
    orderNumber: row.order_number,
    orderRef: formatOrderRef(row.order_number),
    companyName: row.company_name,
    contactName: row.contact_name,
    purchaseOrder: row.purchase_order,
    status: row.status,
    estimatedDeliveryDate: row.estimated_delivery_date,
    notes: row.notes,
    totalItems: row.total_items,
    totalPieces: row.total_pieces,
    items: Array.isArray(row.items_snapshot) ? row.items_snapshot : [],
    originalCreatedAt: row.original_created_at,
    deletedAt: row.deleted_at,
    deletedByEmail: row.deleted_by_email
});

export async function fetchDeletedOrders(
    supabase: SupabaseClient
): Promise<DeletedOrderHistoryEntry[]> {
    const { data, error } = await supabase
        .from('deleted_orders_history')
        .select(
            'id, order_uuid, order_number, company_name, contact_name, purchase_order, status, estimated_delivery_date, notes, total_items, total_pieces, items_snapshot, original_created_at, deleted_at, deleted_by_email'
        )
        .order('deleted_at', { ascending: false });
    if (error) throw error;
    return ((data || []) as RawRow[]).map(mapRow);
}
