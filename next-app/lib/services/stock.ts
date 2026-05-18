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

export const fetchStockForUser = async (
    supabase: SupabaseClient,
    userId: string
): Promise<StockRow[]> => {
    const { data: link, error: linkErr } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();
    if (linkErr) throw linkErr;
    if (!link?.company_id) return [];

    const { data, error } = await supabase
        .from('company_stock')
        .select(
            `
            id, product_id, size, quantity_on_hand, quantity_reserved, last_movement_at,
            product:products ( id, product_code, name, product_type, fabric_type, image_url, unit_price )
        `
        )
        .eq('company_id', link.company_id)
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
