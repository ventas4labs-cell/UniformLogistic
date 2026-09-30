import type { SupabaseClient } from '@supabase/supabase-js';

export interface StockRow {
    id: string;
    productId: string;
    productCode: string;
    productName: string;
    productType: 'shirt' | 'pant';
    fabricType: string | null;
    imageUrl: string | null;
    unitPrice: number | null;
    size: string;
    quantityOnHand: number;
    quantityReserved: number;
    quantityAvailable: number;
    lastMovementAt: string;
}

interface RawProduct {
    id: string;
    product_code: string;
    name: string;
    product_type: 'shirt' | 'pant';
    fabric_type: string | null;
    image_url: string | null;
    unit_price: number | null;
}

interface RawStockRow {
    id: string;
    product_id: string;
    size: string;
    quantity_on_hand: number;
    quantity_reserved: number;
    last_movement_at: string;
    product: RawProduct | RawProduct[] | null;
}

const pickOne = <T,>(v: T | T[] | null | undefined): T | null => {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
};

const fetchCompanyIdForUser = async (
    supabase: SupabaseClient,
    userId: string
): Promise<string | null> => {
    const { data: link, error } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    return (link?.company_id as string | undefined) ?? null;
};

export const fetchStockForUser = async (
    supabase: SupabaseClient,
    userId: string
): Promise<StockRow[]> => {
    const companyId = await fetchCompanyIdForUser(supabase, userId);
    if (!companyId) return [];

    const { data, error } = await supabase
        .from('company_stock')
        .select(
            `
            id, product_id, size, quantity_on_hand, quantity_reserved, last_movement_at,
            product:products ( id, product_code, name, product_type, fabric_type, image_url, unit_price )
        `
        )
        .eq('company_id', companyId)
        .order('product_id')
        .order('size');
    if (error) throw error;

    return ((data || []) as unknown as RawStockRow[])
        .map((r) => {
            const p = pickOne(r.product);
            if (!p) return null;
            const onHand = Number(r.quantity_on_hand ?? 0);
            const reserved = Number(r.quantity_reserved ?? 0);
            return {
                id: r.id,
                productId: p.id,
                productCode: p.product_code,
                productName: p.name,
                productType: p.product_type,
                fabricType: p.fabric_type,
                imageUrl: p.image_url,
                unitPrice: p.unit_price !== null ? Number(p.unit_price) : null,
                size: r.size,
                quantityOnHand: onHand,
                quantityReserved: reserved,
                quantityAvailable: Math.max(0, onHand - reserved),
                lastMovementAt: r.last_movement_at
            } satisfies StockRow;
        })
        .filter((r): r is StockRow => r !== null);
};

export interface StockSummary {
    skuCount: number;
    totalOnHand: number;
    totalAvailable: number;
    estimatedValue: number; // sum of qty × unit_price
    byProduct: Map<
        string,
        {
            productId: string;
            productCode: string;
            productName: string;
            productType: 'shirt' | 'pant';
            imageUrl: string | null;
            unitPrice: number | null;
            totalOnHand: number;
            totalAvailable: number;
            sizeCount: number;
        }
    >;
}

/**
 * Admin: stock across ALL companies, grouped per company. Server-only.
 * Performs ONE join query, then pivots client-side to avoid N+1.
 */
export interface CompanyStockGroup {
    company: { id: string; name: string };
    rows: StockRow[];
    summary: StockSummary;
}

export const fetchAllStockGroupedByCompany = async (
    supabase: SupabaseClient
): Promise<CompanyStockGroup[]> => {
    const { data, error } = await supabase
        .from('company_stock')
        .select(
            `
            id, product_id, size, quantity_on_hand, quantity_reserved, last_movement_at,
            company_id,
            company:companies ( id, name ),
            product:products ( id, product_code, name, product_type, fabric_type, image_url, unit_price )
        `
        )
        .order('company_id')
        .order('product_id')
        .order('size');
    if (error) throw error;

    interface RawAdminStockRow extends RawStockRow {
        company_id: string;
        company: { id: string; name: string } | { id: string; name: string }[] | null;
    }

    const groups = new Map<string, CompanyStockGroup>();
    ((data || []) as unknown as RawAdminStockRow[]).forEach((r) => {
        const c = pickOne(r.company);
        const p = pickOne(r.product);
        if (!c || !p) return;
        const onHand = Number(r.quantity_on_hand ?? 0);
        const reserved = Number(r.quantity_reserved ?? 0);
        const row: StockRow = {
            id: r.id,
            productId: p.id,
            productCode: p.product_code,
            productName: p.name,
            productType: p.product_type,
            fabricType: p.fabric_type,
            imageUrl: p.image_url,
            unitPrice: p.unit_price !== null ? Number(p.unit_price) : null,
            size: r.size,
            quantityOnHand: onHand,
            quantityReserved: reserved,
            quantityAvailable: Math.max(0, onHand - reserved),
            lastMovementAt: r.last_movement_at
        };
        const group: CompanyStockGroup = groups.get(c.id) || {
            company: { id: c.id, name: c.name },
            rows: [],
            summary: {
                skuCount: 0,
                totalOnHand: 0,
                totalAvailable: 0,
                estimatedValue: 0,
                byProduct: new Map()
            }
        };
        group.rows.push(row);
        groups.set(c.id, group);
    });

    // Compute summaries
    groups.forEach((g) => {
        g.summary = summarizeStock(g.rows);
    });

    return Array.from(groups.values()).sort((a, b) =>
        a.company.name.localeCompare(b.company.name, 'es')
    );
};

export const summarizeStock = (rows: StockRow[]): StockSummary => {
    const byProduct = new Map<string, StockSummary['byProduct'] extends Map<string, infer V> ? V : never>();
    let totalOnHand = 0;
    let totalAvailable = 0;
    let estimatedValue = 0;
    rows.forEach((r) => {
        totalOnHand += r.quantityOnHand;
        totalAvailable += r.quantityAvailable;
        if (r.unitPrice) estimatedValue += r.unitPrice * r.quantityOnHand;
        const existing = byProduct.get(r.productId) || {
            productId: r.productId,
            productCode: r.productCode,
            productName: r.productName,
            productType: r.productType,
            imageUrl: r.imageUrl,
            unitPrice: r.unitPrice,
            totalOnHand: 0,
            totalAvailable: 0,
            sizeCount: 0
        };
        existing.totalOnHand += r.quantityOnHand;
        existing.totalAvailable += r.quantityAvailable;
        existing.sizeCount += 1;
        byProduct.set(r.productId, existing);
    });
    return {
        skuCount: rows.length,
        totalOnHand,
        totalAvailable,
        estimatedValue,
        byProduct
    };
};

// ─── An order as a retiro shortcut ───────────────────────────────────
//
// Stock is pooled per (product, size) — once Empaque pushes an order into
// the bodega, the pieces stop belonging to that order. But customers think
// in orders ("send me the ORDEN-00030 pants"), so the "Retirar" button on a
// ready order card opens the retiro picker pre-filled with the product/size/
// quantity mix that order put into the bodega, capped at what is available
// right now.

export interface StockedOrderLine {
    productId: string;
    size: string;
    quantity: number;
}

export interface StockedOrder {
    orderId: string;
    /** One line per product+size. */
    lines: StockedOrderLine[];
}

interface RawStockedEntry {
    items:
        | {
              quantity: number;
              item: { product_id: string | null; size: string } | { product_id: string | null; size: string }[] | null;
          }[]
        | null;
}

export const stockKey = (productId: string, size: string) => `${productId}|${size}`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What one of the user's orders put into their bodega. Null when the id is
 * malformed, the order belongs to another company, or nothing was stocked.
 */
export const fetchStockedOrderForUser = async (
    supabase: SupabaseClient,
    userId: string,
    orderId: string
): Promise<StockedOrder | null> => {
    // The id comes straight from the URL — a malformed one would fail the
    // uuid cast in Postgres and take the whole page down with it.
    if (!UUID_RE.test(orderId)) return null;
    const companyId = await fetchCompanyIdForUser(supabase, userId);
    if (!companyId) return null;

    // RLS (0047) already limits a customer to their own company's entries,
    // but the admin can read all of them — the explicit company scope keeps
    // this correct for every caller.
    const { data, error } = await supabase
        .from('order_stock_entries')
        .select(
            `
            origin:orders!inner ( company_id ),
            items:order_stock_entry_items ( quantity, item:order_items ( product_id, size ) )
        `
        )
        .eq('order_id', orderId)
        .eq('origin.company_id', companyId);
    if (error) throw error;

    // An order can be stocked across several partial entries, and extras
    // can repeat a size — fold both down to one line per product+size.
    const lines = new Map<string, StockedOrderLine>();
    for (const e of (data || []) as unknown as RawStockedEntry[]) {
        for (const it of e.items || []) {
            const oi = pickOne(it.item);
            if (!oi?.product_id) continue;
            const k = stockKey(oi.product_id, oi.size);
            const line = lines.get(k) || { productId: oi.product_id, size: oi.size, quantity: 0 };
            line.quantity += Number(it.quantity || 0);
            lines.set(k, line);
        }
    }
    return lines.size > 0 ? { orderId, lines: Array.from(lines.values()) } : null;
};

/**
 * How many of each order's stocked pieces could be withdrawn right now —
 * what the order put into the bodega, capped per size at the pooled
 * availability. Keyed by order uuid; orders with nothing left are omitted.
 * Pure: works off the orders, stock-entry totals and stock rows a page has
 * already loaded.
 */
export const withdrawablePiecesByOrder = (
    orders: { uuid?: string; items: { uuid?: string; productUuid?: string; selection: { size?: string } }[] }[],
    stockTotals: Map<string, Map<string, number>>,
    stockRows: StockRow[]
): Map<string, number> => {
    // Match by product uuid, not code: a line's code is a snapshot and
    // product codes change (0049), so an old code can miss its product or
    // land on another one.
    const available = new Map<string, number>();
    for (const r of stockRows) available.set(stockKey(r.productId, r.size), r.quantityAvailable);

    const out = new Map<string, number>();
    for (const o of orders) {
        const perItem = o.uuid ? stockTotals.get(o.uuid) : undefined;
        if (!o.uuid || !perItem) continue;
        const stocked = new Map<string, number>();
        for (const it of o.items) {
            const q = it.uuid ? perItem.get(it.uuid) || 0 : 0;
            if (q <= 0 || !it.productUuid) continue;
            const k = stockKey(it.productUuid, it.selection.size || '');
            stocked.set(k, (stocked.get(k) || 0) + q);
        }
        let pieces = 0;
        for (const [k, q] of stocked) pieces += Math.min(q, available.get(k) || 0);
        if (pieces > 0) out.set(o.uuid, pieces);
    }
    return out;
};
