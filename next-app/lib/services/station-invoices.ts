import type { SupabaseClient } from '@supabase/supabase-js';

export type StationInvoiceStatus = 'pending' | 'approved' | 'rejected';

export interface StationInvoice {
    id: string;
    stationUserId: string;
    /** Display name + stage label, joined at fetch time for admin lists. */
    stationDisplayName: string | null;
    stationStage: string | null;
    orderId: string | null;
    /** Human-readable order ref (ORDEN-00012), resolved at fetch time. */
    orderRef: string | null;
    imageUrl: string;
    amount: number | null;
    notes: string;
    status: StationInvoiceStatus;
    submittedAt: string;
    reviewedAt: string | null;
    reviewedBy: string | null;
    reviewNotes: string;
}

export interface StationInvoiceInput {
    stationUserId: string;
    orderId?: string | null;
    imageUrl: string;
    amount?: number | null;
    notes?: string;
}

interface RawRow {
    id: string;
    station_user_id: string;
    order_id: string | null;
    image_url: string;
    amount: number | string | null;
    notes: string | null;
    status: StationInvoiceStatus;
    submitted_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    review_notes: string | null;
    station: { display_name: string | null; stage: string | null } | null;
    order: { order_number: number | null } | null;
}

const SELECT = `
    id, station_user_id, order_id, image_url, amount, notes, status,
    submitted_at, reviewed_at, reviewed_by, review_notes,
    station:station_users ( display_name, stage ),
    order:orders ( order_number )
`;

const pickOne = <T>(value: T | T[] | null | undefined): T | null => {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
};

const mapRow = (r: RawRow): StationInvoice => {
    const station = pickOne(r.station);
    const order = pickOne(r.order);
    return {
        id: r.id,
        stationUserId: r.station_user_id,
        stationDisplayName: station?.display_name ?? null,
        stationStage: station?.stage ?? null,
        orderId: r.order_id,
        orderRef:
            order?.order_number != null
                ? `ORDEN-${String(order.order_number).padStart(5, '0')}`
                : null,
        imageUrl: r.image_url,
        amount: r.amount != null ? Number(r.amount) : null,
        notes: r.notes || '',
        status: r.status,
        submittedAt: r.submitted_at,
        reviewedAt: r.reviewed_at,
        reviewedBy: r.reviewed_by,
        reviewNotes: r.review_notes || ''
    };
};

export async function createStationInvoice(
    supabase: SupabaseClient,
    input: StationInvoiceInput
): Promise<StationInvoice> {
    const { data, error } = await supabase
        .from('station_invoices')
        .insert({
            station_user_id: input.stationUserId,
            order_id: input.orderId || null,
            image_url: input.imageUrl,
            amount:
                input.amount != null && Number.isFinite(input.amount)
                    ? input.amount
                    : null,
            notes: input.notes?.trim() || null
        })
        .select(SELECT)
        .single();
    if (error) throw error;
    return mapRow(data as unknown as RawRow);
}

export async function fetchStationInvoicesForStation(
    supabase: SupabaseClient,
    stationUserId: string
): Promise<StationInvoice[]> {
    const { data, error } = await supabase
        .from('station_invoices')
        .select(SELECT)
        .eq('station_user_id', stationUserId)
        .order('submitted_at', { ascending: false });
    if (error) throw error;
    return ((data || []) as unknown as RawRow[]).map(mapRow);
}

export async function fetchAllStationInvoices(
    supabase: SupabaseClient
): Promise<StationInvoice[]> {
    const { data, error } = await supabase
        .from('station_invoices')
        .select(SELECT)
        .order('submitted_at', { ascending: false });
    if (error) throw error;
    return ((data || []) as unknown as RawRow[]).map(mapRow);
}

/**
 * Upload an invoice photo into the station-invoices bucket and return
 * its public URL. Path is prefixed by station-user id so an admin can
 * eyeball a folder per contractor in the Supabase dashboard.
 */
export async function uploadStationInvoiceImage(
    supabase: SupabaseClient,
    stationUserId: string,
    file: File
): Promise<string> {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${stationUserId}/invoice-${Date.now()}.${ext}`;
    const buffer = await file.arrayBuffer();
    const { error } = await supabase.storage
        .from('station-invoices')
        .upload(path, new Uint8Array(buffer), {
            upsert: false,
            contentType: file.type || 'image/jpeg'
        });
    if (error) throw error;
    const { data } = supabase.storage.from('station-invoices').getPublicUrl(path);
    return data.publicUrl;
}
