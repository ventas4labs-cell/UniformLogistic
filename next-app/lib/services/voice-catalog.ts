// ─── Voice catalog builder ────────────────────────────────────────────
// Used by /api/admin/stock/voice-parse and -apply to give the LLM the
// exact SKUs it is allowed to pick from. Each entry is a (product × size)
// pair the company has been granted; if a company_stock row already
// exists for the pair, its id is pre-resolved.
//
// Sizes are expanded the SAME way the customer checkout produces size
// strings (see selectionToSizeString in lib/services/orders.ts):
//   shirts  →  "H · M" / "M · 2XL" (gender prefix)
//   pants   →  "C32\"" / "C32\" / L30\"" (waist + optional inseam)
// So a SKU dictated by voice writes the same string the customer would
// have ordered.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

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
}

function expandSizes(p: ProductRow): string[] {
    const sj = p.sizes_json || {};
    const out: string[] = [];

    if (p.product_type === 'shirt') {
        // Shirts: gender-prefixed strings. Unisex products get both
        // H · and M · variants so warehouse can split inventory.
        if (p.gender === 'men') {
            (sj.men || []).forEach((s) => out.push(`H · ${s}`));
        } else if (p.gender === 'women') {
            (sj.women || []).forEach((s) => out.push(`M · ${s}`));
        } else {
            (sj.men || []).forEach((s) => out.push(`H · ${s}`));
            (sj.women || []).forEach((s) => out.push(`M · ${s}`));
            if (out.length === 0) {
                // No gendered size lists configured — fall back to bare labels.
                (sj.men || sj.women || []).forEach((s) => out.push(s));
            }
        }
        return out;
    }

    // Pants: `C<waist>"` with optional `/ L<inseam>"`.
    const waists = sj.waist || [];
    const inseams = sj.inseam || [];
    if (inseams.length > 0) {
        for (const w of waists) {
            for (const i of inseams) out.push(`C${w}" / L${i}"`);
        }
    } else {
        for (const w of waists) out.push(`C${w}"`);
    }
    return out;
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
    // 1. Products this company is allowed to order (catalog assignment).
    const { data: assigned, error: assignedErr } = await supabase
        .from('company_products')
        .select(
            `
            product:products (
                id, product_code, name, product_type, gender,
                sizes_json, fabric_type
            )
        `
        )
        .eq('company_id', companyId)
        .eq('is_active', true);
    if (assignedErr) throw assignedErr;

    const products: ProductRow[] = (assigned || [])
        .map((row: CompanyProductJoin) => pickOne(row.product))
        .filter((p): p is ProductRow => Boolean(p));

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
        for (const size of expandSizes(p)) {
            catalog.push({
                product_id: p.id,
                product_code: p.product_code,
                product_name: p.name,
                product_type: p.product_type,
                gender: p.gender,
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
