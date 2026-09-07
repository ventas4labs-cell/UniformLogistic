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
    orderId: string;
    orderRef: string;
    companyName: string;
    contactName: string;
    scheduledDate: string; // YYYY-MM-DD
    totalPieces: number;
    items: { name: string; size: string; quantity: number }[];
}

interface RawPlanRow {
    order_id: string;
    scheduled_date: string;
    order:
        | {
              order_number: number;
              company: { name: string; contact_name: string } | { name: string; contact_name: string }[] | null;
              items: { id: string; product_name: string; size: string | null; quantity: number }[] | null;
          }
        | null
        | {
              order_number: number;
              company: { name: string; contact_name: string } | { name: string; contact_name: string }[] | null;
              items: { id: string; product_name: string; size: string | null; quantity: number }[] | null;
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
            'order_id, scheduled_date, order:orders ( order_number, company:companies ( name, contact_name ), items:order_items ( id, product_name, size, quantity ) )'
        )
        .not('scheduled_date', 'is', null)
        .is('delivered_at', null)
        .order('scheduled_date', { ascending: true });
    if (error) throw error;

    // The courier carries only the pieces routed to entrega. An order can be
    // split with the rest going to the customer's stock, so the ordered
    // quantity would over-state what actually goes on the truck.
    const rows = (data as unknown as RawPlanRow[]) || [];
    const planOrderIds = rows.map((r) => r.order_id);
    const dispatchedByItem = new Map<string, number>();
    if (planOrderIds.length > 0) {
        const { data: dispRows, error: dispErr } = await supabase
            .from('order_dispatch_items')
            .select('order_item_id, quantity, dispatch:order_dispatches!inner(order_id)')
            .in('dispatch.order_id', planOrderIds);
        if (dispErr) throw dispErr;
        for (const d of (dispRows || []) as { order_item_id: string; quantity: number }[]) {
            dispatchedByItem.set(
                d.order_item_id,
                (dispatchedByItem.get(d.order_item_id) || 0) + d.quantity
            );
        }
    }

    const out: DriverPlanOrder[] = [];
    for (const r of rows) {
        const order = pickOne(r.order);
        if (!order) continue;
        const company = pickOne(order.company);
        const items = (order.items || [])
            .map((it) => ({
                name: it.product_name,
                size: it.size || '',
                quantity: Math.min(dispatchedByItem.get(it.id) || 0, it.quantity)
            }))
            .filter((it) => it.quantity > 0);
        out.push({
            orderId: r.order_id,
            orderRef: `ORDEN-${String(order.order_number).padStart(5, '0')}`,
            companyName: company?.name || '',
            contactName: company?.contact_name || '',
            scheduledDate: r.scheduled_date,
            totalPieces: items.reduce((s, i) => s + i.quantity, 0),
            items
        });
    }
    // Scheduled stock retiros ride the same plan — they live in their own
    // table (order_deliveries FKs to orders) but the courier sees one list.
    const { data: retiroRows, error: retiroErr } = await supabase
        .from('stock_withdrawals')
        .select(
            'id, withdrawal_number, scheduled_date, recipient_name, company:companies(name, contact_name), items:stock_withdrawal_items(quantity, size, product:products(name))'
        )
        .eq('status', 'approved')
        .eq('wants_delivery', true)
        .not('scheduled_date', 'is', null)
        .is('delivered_at', null)
        .order('scheduled_date', { ascending: true });
    if (retiroErr && (retiroErr as { code?: string }).code !== '42P01') throw retiroErr;

    for (const r of (retiroRows || []) as unknown as {
        id: string;
        withdrawal_number: number;
        scheduled_date: string;
        recipient_name: string | null;
        company: { name: string; contact_name: string } | { name: string; contact_name: string }[] | null;
        items: { quantity: number; size: string | null; product: { name: string } | { name: string }[] | null }[] | null;
    }[]) {
        const company = pickOne(r.company);
        const items = (r.items || []).map((it) => ({
            name: pickOne(it.product)?.name || '—',
            size: it.size || '',
            quantity: it.quantity
        }));
        out.push({
            orderId: r.id,
            orderRef: `RETIRO-${String(r.withdrawal_number).padStart(5, '0')}`,
            companyName: company?.name || '',
            contactName: r.recipient_name || company?.contact_name || '',
            scheduledDate: r.scheduled_date,
            totalPieces: items.reduce((s, i) => s + i.quantity, 0),
            items
        });
    }

    out.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    return out;
}
