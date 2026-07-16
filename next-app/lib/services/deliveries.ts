import type { SupabaseClient } from '@supabase/supabase-js';

// One delivery record per order (order_deliveries). State is derived:
//   unscheduled → scheduledDate null, not delivered
//   scheduled   → scheduledDate set, not delivered
//   delivered   → deliveredAt set
export interface DeliveryRecord {
    orderId: string;
    scheduledDate: string | null; // YYYY-MM-DD
    scheduledAt: string | null;
    notifiedAt: string | null;
    deliveredAt: string | null;
    notes: string | null;
}

interface RawRow {
    order_id: string;
    scheduled_date: string | null;
    scheduled_at: string | null;
    notified_at: string | null;
    delivered_at: string | null;
    notes: string | null;
}

const mapRow = (r: RawRow): DeliveryRecord => ({
    orderId: r.order_id,
    scheduledDate: r.scheduled_date,
    scheduledAt: r.scheduled_at,
    notifiedAt: r.notified_at,
    deliveredAt: r.delivered_at,
    notes: r.notes
});

export async function fetchDeliveriesForOrders(
    supabase: SupabaseClient,
    orderIds: string[]
): Promise<Map<string, DeliveryRecord>> {
    const out = new Map<string, DeliveryRecord>();
    if (orderIds.length === 0) return out;
    const { data, error } = await supabase
        .from('order_deliveries')
        .select('order_id, scheduled_date, scheduled_at, notified_at, delivered_at, notes')
        .in('order_id', orderIds);
    if (error) throw error;
    for (const r of (data as unknown as RawRow[]) || []) {
        out.set(r.order_id, mapRow(r));
    }
    return out;
}

// ─── Driver link (single shared token) ──────────────────────────────
const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    !v ? null : Array.isArray(v) ? (v[0] ?? null) : v;

/** The current driver-link token, or null if none generated yet. */
export async function fetchDriverLinkToken(
    supabase: SupabaseClient
): Promise<string | null> {
    const { data, error } = await supabase
        .from('delivery_driver_link')
        .select('token')
        .eq('id', 'default')
        .maybeSingle();
    if (error) throw error;
    return data?.token ?? null;
}

/** True if `token` is the current driver link (validates /d/<token>). */
export async function isValidDriverToken(
    supabase: SupabaseClient,
    token: string
): Promise<boolean> {
    if (!token || token.length < 16) return false;
    const { data } = await supabase
        .from('delivery_driver_link')
        .select('id')
        .eq('token', token)
        .maybeSingle();
    return !!data;
}

export interface DriverPlanOrder {
    orderRef: string;
    companyName: string;
    contactName: string;
    scheduledDate: string; // YYYY-MM-DD
    totalPieces: number;
    items: { name: string; size: string; quantity: number }[];
}

interface RawPlanRow {
    scheduled_date: string;
    order:
        | {
              order_number: number;
              company: { name: string; contact_name: string } | { name: string; contact_name: string }[] | null;
              items: { product_name: string; size: string | null; quantity: number }[] | null;
          }
        | null
        | {
              order_number: number;
              company: { name: string; contact_name: string } | { name: string; contact_name: string }[] | null;
              items: { product_name: string; size: string | null; quantity: number }[] | null;
          }[];
}

/**
 * The delivery plan for the driver: every scheduled, not-yet-delivered
 * order with its details, ordered by date. Read with the service-role
 * client from the public /d/<token> route.
 */
export async function fetchDeliveryPlan(
    supabase: SupabaseClient
): Promise<DriverPlanOrder[]> {
    const { data, error } = await supabase
        .from('order_deliveries')
        .select(
            'scheduled_date, order:orders ( order_number, company:companies ( name, contact_name ), items:order_items ( product_name, size, quantity ) )'
        )
        .not('scheduled_date', 'is', null)
        .is('delivered_at', null)
        .order('scheduled_date', { ascending: true });
    if (error) throw error;
    const out: DriverPlanOrder[] = [];
    for (const r of (data as unknown as RawPlanRow[]) || []) {
        const order = pickOne(r.order);
        if (!order) continue;
        const company = pickOne(order.company);
        const items = (order.items || []).map((it) => ({
            name: it.product_name,
            size: it.size || '',
            quantity: it.quantity
        }));
        out.push({
            orderRef: `ORDEN-${String(order.order_number).padStart(5, '0')}`,
            companyName: company?.name || '',
            contactName: company?.contact_name || '',
            scheduledDate: r.scheduled_date,
            totalPieces: items.reduce((s, i) => s + i.quantity, 0),
            items
        });
    }
    return out;
}
