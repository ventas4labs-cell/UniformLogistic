// ─── Voice catalog builder ────────────────────────────────────────────
// Used by /api/admin/stock/voice-parse and -apply to give the LLM the
// exact SKUs it is allowed to pick from. Each entry is a (product × size)
// pair available to the company; if a company_stock row already
// exists for the pair, its id is pre-resolved.
//
// Keep checkout's canonical size labels and also allow XS and either
// gender for every stock product, regardless of its catalog audience.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { manualStockSizes, splitStockSize, stockProductSizes } from '@/lib/stock-size';

export interface VoiceCatalogEntry {
    product_id: string;
    product_code: string;
    product_name: string;
    product_type: 'shirt' | 'pant';
    gender: 'men' | 'women' | 'unisex';
    fabric_type: string | null;
    size: string; // canonical, exactly matches company_stock.size
    /** Existing SKU row id (when one exists); null means the row will be
     *  inserted by upsert_company_stock_movement on first write. */
    company_stock_id: string | null;
}

interface ProductRow {
    id: string;
    product_code: string;
    name: string;
    product_type: 'shirt' | 'pant';
    gender: 'men' | 'women' | 'unisex';
    sizes_json: {
        men?: string[];
        women?: string[];
        waist?: number[];
        inseam?: number[];
    } | null;
    fabric_type: string | null;
    is_active?: boolean;
}

interface CompanyProductJoin {
    product: ProductRow | ProductRow[] | null;
}

const pickOne = <T>(v: T | T[] | null | undefined): T | null =>
    !v ? null : Array.isArray(v) ? (v[0] ?? null) : v;

/**
 * Build the catalog of (product × size) pairs that voice dictation may
 * target for a given company. Includes existing company_stock_id when
 * one already exists, so the route handler can short-circuit and the
 * client can show current on-hand without an extra round-trip.
 */
export async function buildVoiceCatalog(
    supabase: SupabaseClient,
    companyId: string
): Promise<VoiceCatalogEntry[]> {
    return buildStockCatalog(supabase, companyId, false);
}

/** Manual stock also supports unspecified sizes and optional gender. */
export async function buildManualStockCatalog(
    supabase: SupabaseClient,
    companyId: string
): Promise<VoiceCatalogEntry[]> {
    return buildStockCatalog(supabase, companyId, true);
}

async function buildStockCatalog(
    supabase: SupabaseClient,
    companyId: string,
    manual: boolean
): Promise<VoiceCatalogEntry[]> {
    // 1. Company assignments plus shared basic products. Customers can
    // order basic products without a company_products row, so manual stock
    // entry must offer those too.
    const { data: assigned, error: assignedErr } = await supabase
        .from('company_products')
        .select(
            `
            product:products (
                id, product_code, name, product_type, gender,
                sizes_json, fabric_type, is_active
            )
        `
        )
        .eq('company_id', companyId)
        .eq('is_active', true);
    if (assignedErr) throw assignedErr;

    const { data: basic, error: basicErr } = await supabase
        .from('products')
        .select('id, product_code, name, product_type, gender, sizes_json, fabric_type')
        .eq('is_basic', true)
        .eq('is_active', true);
    if (basicErr) throw basicErr;

    const assignedProducts = (assigned || [])
        .map((row: CompanyProductJoin) => pickOne(row.product))
        .filter((p): p is ProductRow => Boolean(p && p.is_active !== false));
    const products = Array.from(
        new Map(
            [...assignedProducts, ...((basic || []) as ProductRow[])].map((p) => [p.id, p])
        ).values()
    );

    if (products.length === 0) return [];

    // 2. Existing SKU rows for this company so we can pre-resolve ids.
    const { data: existing, error: existingErr } = await supabase
        .from('company_stock')
        .select('id, product_id, size')
        .eq('company_id', companyId);
    if (existingErr) throw existingErr;

    const existingMap = new Map<string, string>();
    (existing || []).forEach((r: { id: string; product_id: string; size: string }) => {
        existingMap.set(`${r.product_id}|${r.size}`, r.id);
    });

    // 3. Cartesian expand into the catalog.
    const catalog: VoiceCatalogEntry[] = [];
    for (const p of products) {
        const configuredSizes = stockProductSizes(p);
        const sizes = manual ? manualStockSizes(configuredSizes) : configuredSizes;
        for (const size of sizes) {
            catalog.push({
                product_id: p.id,
                product_code: p.product_code,
                product_name: p.name,
                product_type: p.product_type,
                gender: splitStockSize(size).gender ?? p.gender,
                fabric_type: p.fabric_type,
                size,
                company_stock_id: existingMap.get(`${p.id}|${size}`) ?? null
            });
        }
    }
    return catalog;
}

/**
 * One catalog line for the LLM system prompt. Stable, machine-parsable
 * format so Claude can quote `product_id` and `size` back exactly.
 */
export function formatCatalogLine(entry: VoiceCatalogEntry, idx: number): string {
    const typeLabel = entry.product_type === 'shirt' ? 'Camisa' : 'Pantalón';
    return `${idx + 1}. [pid=${entry.product_id}] ${entry.product_code} · ${entry.product_name} (${typeLabel}, ${entry.gender}) — talla "${entry.size}"`;
}
