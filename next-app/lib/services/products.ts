import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product, ProductType } from '@/lib/types';

export interface BomItem {
    name: string;
    // Default consumption per unit. Used when `qtyBySize` has no entry
    // matching the line item's size, or when this insumo is consumed
    // uniformly across every size.
    qty: number;
    // Optional per-size override. Keys are size labels as they appear
    // in `sizes.men` / `sizes.women` (e.g. "XXL", "2XL", "3XL"). Lookup
    // is case-insensitive and whitespace-tolerant — see resolveBomQty.
    // Used for extra-large shirts where fabric / interlining / zipper
    // consumption is higher than the base SKU.
    qtyBySize?: Record<string, number>;
    // Optional logo linkage. When `logoId` is set, this BOM row
    // represents a logo applied to the product rather than a generic
    // insumo. `logoImageUrl` and `logoCategory` are snapshots from the
    // logos catalog at the time of save so the boards can render the
    // image and route by category without an extra join. `name` mirrors
    // the logo's display name and is read-only in the UI when logoId
    // is present.
    logoId?: string;
    logoImageUrl?: string;
    logoCategory?: 'bordado' | 'impresion';
}

/** Normalize a size label for case-insensitive override lookups. */
const normSizeKey = (s: string): string => s.trim().toLowerCase();

/**
 * Resolve the per-unit consumption of a BOM line for an actual order
 * item size. Returns the override if one is configured for the size,
 * otherwise the base `qty`.
 */
export const resolveBomQty = (
    item: BomItem,
    sizeLabel: string | null | undefined
): number => {
    if (!sizeLabel || !item.qtyBySize) return item.qty;
    const want = normSizeKey(sizeLabel);
    for (const [k, v] of Object.entries(item.qtyBySize)) {
        if (normSizeKey(k) === want && Number.isFinite(v) && v > 0) return v;
    }
    return item.qty;
};

/**
 * Pull the bare size label out of the persisted order-item size
 * string. The string is produced by selectionToSizeString in
 * services/orders.ts and looks like:
 *
 *   "H · XXL"       → "XXL"   (men's shirt, extra-extra-large)
 *   "M · 2XL"       → "2XL"   (women's shirt)
 *   "XXL"           → "XXL"   (no gender prefix, possible)
 *   "C32\" / L30\"" → null    (pants — per-size BOM is shirt-only for now)
 *
 * Returning null for pants disables per-size lookup so they fall back
 * to the base qty without a key-collision risk.
 */
export const extractSizeLabel = (
    storedSize: string | null | undefined
): string | null => {
    if (!storedSize) return null;
    const trimmed = storedSize.trim();
    if (!trimmed) return null;
    // Pants — "C32\"" or "C32\" / L30\""
    if (/^c\d+/i.test(trimmed)) return null;
    // Strip "H · " or "M · " gender prefix.
    const m = trimmed.match(/^[HM]\s*·\s*(.+)$/);
    return (m ? m[1] : trimmed).trim();
};

export interface ProductRow {
    id: string;
    product_code: string;
    name: string;
    description: string | null;
    image_url: string | null;
    product_type: 'shirt' | 'pant';
    type_label: string | null;
    gender: 'men' | 'women' | 'unisex';
    sizes_json: Product['sizes'] | null;
    fabric_type: string | null;
    is_active: boolean | null;
    bom_json: BomItem[] | null;
    codigo_cabys: string | null;
}

// Legacy rows pre-migration may have type_label = null. Derive a
// sensible default from the size-shape enum so the UI never renders
// an empty type pill.
const defaultTypeLabel = (productType: 'shirt' | 'pant'): string =>
    productType === 'shirt' ? 'Camisa' : 'Pantalón';

export interface AdminProduct extends Product {
    uuid: string;
    fabricType: string;
    isActive: boolean;
    bom: BomItem[];
    codigoCabys: string;
    /** UUIDs of companies the product is currently assigned to. */
    companyIds: string[];
}

const genderToCategory = (gender: ProductRow['gender']): Product['category'] => {
    if (gender === 'men') return 'Men';
    if (gender === 'women') return 'Women';
    return 'Unisex';
};

export const mapProductRow = (
    row: ProductRow,
    companyIds: string[] = []
): AdminProduct => ({
    id: row.product_code,
    uuid: row.id,
    name: row.name,
    type: row.product_type as ProductType,
    typeLabel: row.type_label?.trim() || defaultTypeLabel(row.product_type),
    image: row.image_url || '',
    description: row.description || '',
    category: genderToCategory(row.gender),
    sizes: row.sizes_json || {},
    fabricType: row.fabric_type || '',
    isActive: row.is_active !== false,
    bom: (row.bom_json as BomItem[]) || [],
    codigoCabys: row.codigo_cabys || '',
    companyIds
});

export const fetchCatalogForCompany = async (
    supabase: SupabaseClient,
    companyId: string
): Promise<AdminProduct[]> => {
    const { data, error } = await supabase
        .from('company_products')
        .select(`
            product:products (
                id, product_code, name, description, image_url,
                product_type, type_label, gender, sizes_json, fabric_type, is_active, bom_json, codigo_cabys
            )
        `)
        .eq('company_id', companyId)
        .eq('is_active', true);
    if (error) throw error;

    return (data || [])
        .map((row: { product: ProductRow | ProductRow[] | null }) =>
            Array.isArray(row.product) ? row.product[0] : row.product
        )
        .filter((p): p is ProductRow => Boolean(p))
        .filter((p) => p.is_active !== false)
        .map((p) => mapProductRow(p));
};

export const fetchCatalogForUser = async (
    supabase: SupabaseClient,
    userId: string
): Promise<AdminProduct[]> => {
    const { data: link, error: linkError } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();
    if (linkError) throw linkError;
    if (!link?.company_id) return [];
    return fetchCatalogForCompany(supabase, link.company_id);
};

export const fetchUserCompanyId = async (
    supabase: SupabaseClient,
    userId: string
): Promise<string | null> => {
    const { data, error } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    return data?.company_id || null;
};

export interface ProductInput {
    productCode: string;
    name: string;
    description: string;
    imageUrl: string;
    productType: ProductType;
    /**
     * Free-text "Tipo" the admin typed (e.g. "Chaleco", "Polo",
     * "Pantalón cargo"). Optional — when blank, mapProductRow falls
     * back to "Camisa" / "Pantalón" based on productType.
     */
    typeLabel?: string;
    gender: 'men' | 'women' | 'unisex';
    sizes: Product['sizes'];
    fabricType?: string;
    isActive?: boolean;
    bom?: BomItem[];
    codigoCabys?: string;
    /**
     * Companies to assign the product to. When provided, the
     * company_products junction is reconciled to match — links are
     * added/removed so the row set equals exactly these companyIds.
     * Undefined means leave assignments untouched (back-compat).
     */
    companyIds?: string[];
}

const PRODUCT_SELECT =
    'id, product_code, name, description, image_url, product_type, type_label, gender, sizes_json, fabric_type, is_active, bom_json, codigo_cabys';

interface ProductRowWithLinks extends ProductRow {
    links: { company_id: string }[] | null;
}

export const fetchProducts = async (
    supabase: SupabaseClient
): Promise<AdminProduct[]> => {
    const { data, error } = await supabase
        .from('products')
        .select(`${PRODUCT_SELECT}, links:company_products ( company_id )`)
        .order('product_type', { ascending: true })
        .order('name', { ascending: true });
    if (error) throw error;
    return (data as unknown as ProductRowWithLinks[]).map((row) =>
        mapProductRow(row, (row.links || []).map((l) => l.company_id))
    );
};

/**
 * Reconcile the company_products rows for a single product so they
 * exactly equal `companyIds`. Adds the missing links, deletes the
 * removed ones. Insert ignores duplicates (the unique constraint on
 * (company_id, product_id) protects against races).
 */
const reconcileCompanyAssignments = async (
    supabase: SupabaseClient,
    productUuid: string,
    companyIds: string[]
): Promise<void> => {
    const { data: existing, error: fetchErr } = await supabase
        .from('company_products')
        .select('company_id')
        .eq('product_id', productUuid);
    if (fetchErr) throw fetchErr;
    const current = new Set((existing || []).map((r) => r.company_id as string));
    const wanted = new Set(companyIds);
    const toAdd = [...wanted].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !wanted.has(id));

    if (toAdd.length > 0) {
        const { error } = await supabase.from('company_products').insert(
            toAdd.map((company_id) => ({
                company_id,
                product_id: productUuid,
                is_active: true
            }))
        );
        if (error && !/duplicate/i.test(error.message)) throw error;
    }
    if (toRemove.length > 0) {
        const { error } = await supabase
            .from('company_products')
            .delete()
            .eq('product_id', productUuid)
            .in('company_id', toRemove);
        if (error) throw error;
    }
};

export const createProduct = async (
    supabase: SupabaseClient,
    input: ProductInput
): Promise<AdminProduct> => {
    const { data, error } = await supabase
        .from('products')
        .insert({
            product_code: input.productCode,
            name: input.name,
            description: input.description,
            image_url: input.imageUrl || null,
            product_type: input.productType,
            type_label:
                input.typeLabel?.trim() || defaultTypeLabel(input.productType),
            gender: input.gender,
            sizes_json: input.sizes,
            fabric_type: input.fabricType || null,
            is_active: input.isActive ?? true,
            bom_json: input.bom || [],
            codigo_cabys: input.codigoCabys || null
        })
        .select(PRODUCT_SELECT)
        .single();
    if (error) throw error;
    const row = data as ProductRow;
    if (input.companyIds) {
        await reconcileCompanyAssignments(supabase, row.id, input.companyIds);
    }
    return mapProductRow(row, input.companyIds || []);
};

export const updateProduct = async (
    supabase: SupabaseClient,
    uuid: string,
    input: ProductInput
): Promise<AdminProduct> => {
    const { data, error } = await supabase
        .from('products')
        .update({
            product_code: input.productCode,
            name: input.name,
            description: input.description,
            image_url: input.imageUrl || null,
            product_type: input.productType,
            type_label:
                input.typeLabel?.trim() || defaultTypeLabel(input.productType),
            gender: input.gender,
            sizes_json: input.sizes,
            fabric_type: input.fabricType || null,
            is_active: input.isActive ?? true,
            bom_json: input.bom || [],
            codigo_cabys: input.codigoCabys || null
        })
        .eq('id', uuid)
        .select(PRODUCT_SELECT)
        .single();
    if (error) throw error;
    if (input.companyIds) {
        await reconcileCompanyAssignments(supabase, uuid, input.companyIds);
    }
    return mapProductRow(data as ProductRow, input.companyIds);
};

export const deleteProduct = async (
    supabase: SupabaseClient,
    uuid: string
): Promise<void> => {
    const { error } = await supabase.from('products').delete().eq('id', uuid);
    if (error) throw error;
};

const slugifyName = (name: string): string =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'image';

export const uploadProductImage = async (
    supabase: SupabaseClient,
    file: File
): Promise<string> => {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const base = slugifyName(file.name.replace(/\.[^.]+$/, ''));
    const path = `${base}-${Date.now()}.${ext}`;
    const buffer = await file.arrayBuffer();
    const { error } = await supabase.storage
        .from('product-images')
        .upload(path, new Uint8Array(buffer), {
            upsert: false,
            contentType: file.type || 'image/png'
        });
    if (error) throw error;
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
};
