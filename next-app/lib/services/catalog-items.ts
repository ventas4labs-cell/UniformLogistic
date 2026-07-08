import type { SupabaseClient } from '@supabase/supabase-js';

export type CatalogProductType = 'shirt' | 'pant' | 'other';

// A selectable color option. `hex` drives the swatch in the configurator;
// `name` is what's stored on the quote line and shown to the customer.
export interface CatalogColor {
    name: string;
    hex: string;
}

// One gallery image, tagged with the color it depicts (empty = generic).
export interface CatalogImage {
    url: string;
    color: string;
}

// Pick the image that matches the chosen color (case-insensitive), or
// fall back to the primary image_url / first gallery image. Shared by
// the customer configurator and the admin quote builder so the shown
// image and the saved line image stay consistent.
export function imageForColor(
    item: { imageUrl: string; images: CatalogImage[] },
    colorName: string
): string {
    const want = colorName.trim().toLowerCase();
    if (want) {
        const hit = item.images.find((im) => im.color.trim().toLowerCase() === want);
        if (hit?.url) return hit.url;
    }
    return item.imageUrl || item.images[0]?.url || '';
}

export interface CatalogItem {
    id: string;
    code: string;
    name: string;
    description: string;
    imageUrl: string;
    productType: CatalogProductType;
    // Free-text category derived from the image filename (POLO, TSHIRT…).
    category: string;
    // Gallery images, each tagged with the color it depicts.
    images: CatalogImage[];
    fabricType: string;
    // Selectable options offered to the customer in the configurator.
    fabricOptions: string[];
    colorOptions: CatalogColor[];
    unitPrice: number;
    pricePerLogo: number;
    maxLogos: number;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface CatalogItemInput {
    code: string;
    name: string;
    description?: string;
    imageUrl?: string;
    productType: CatalogProductType;
    category?: string;
    images?: CatalogImage[];
    fabricType?: string;
    fabricOptions?: string[];
    colorOptions?: CatalogColor[];
    unitPrice: number;
    pricePerLogo?: number;
    maxLogos: number;
    isActive?: boolean;
    sortOrder?: number;
}

interface RawRow {
    id: string;
    code: string;
    name: string;
    description: string | null;
    image_url: string | null;
    product_type: string;
    category: string | null;
    images: unknown;
    fabric_type: string | null;
    fabric_options: unknown;
    color_options: unknown;
    unit_price: number | string;
    price_per_logo: number | string | null;
    max_logos: number;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

const num = (n: number | string | null | undefined): number => {
    if (n === null || n === undefined) return 0;
    return typeof n === 'string' ? parseFloat(n) : n;
};

// jsonb columns arrive already parsed from supabase-js, but stay
// defensive: coerce anything unexpected to an empty list rather than
// crashing the whole catalog fetch.
const asFabricList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const asImageList = (v: unknown): CatalogImage[] =>
    Array.isArray(v)
        ? v
              .filter(
                  (x): x is { url?: unknown; color?: unknown } =>
                      !!x && typeof x === 'object'
              )
              .map((x) => ({
                  url: typeof x.url === 'string' ? x.url : '',
                  color: typeof x.color === 'string' ? x.color : ''
              }))
              .filter((im) => im.url)
        : [];

const asColorList = (v: unknown): CatalogColor[] =>
    Array.isArray(v)
        ? v
              .filter(
                  (x): x is { name?: unknown; hex?: unknown } =>
                      !!x && typeof x === 'object'
              )
              .map((x) => ({
                  name: typeof x.name === 'string' ? x.name : '',
                  hex: typeof x.hex === 'string' ? x.hex : '#9ca3af'
              }))
              .filter((c) => c.name)
        : [];

const mapRow = (row: RawRow): CatalogItem => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || '',
    imageUrl: row.image_url || '',
    productType: (row.product_type as CatalogProductType) || 'shirt',
    category: row.category || '',
    images: asImageList(row.images),
    fabricType: row.fabric_type || '',
    fabricOptions: asFabricList(row.fabric_options),
    colorOptions: asColorList(row.color_options),
    unitPrice: num(row.unit_price),
    pricePerLogo: num(row.price_per_logo),
    maxLogos: row.max_logos,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
});

const SELECT =
    'id, code, name, description, image_url, product_type, category, images, fabric_type, fabric_options, color_options, unit_price, price_per_logo, max_logos, is_active, sort_order, created_at, updated_at';

// Column payload shared by create + update so the two can't drift.
const toRow = (input: CatalogItemInput) => ({
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    image_url: input.imageUrl ?? null,
    product_type: input.productType,
    category: input.category ?? '',
    images: input.images ?? [],
    fabric_type: input.fabricType ?? null,
    fabric_options: input.fabricOptions ?? [],
    color_options: input.colorOptions ?? [],
    unit_price: input.unitPrice,
    price_per_logo: input.pricePerLogo ?? 0,
    max_logos: input.maxLogos,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0
});

export async function fetchCatalogItems(
    supabase: SupabaseClient,
    { includeInactive = false }: { includeInactive?: boolean } = {}
): Promise<CatalogItem[]> {
    let q = supabase
        .from('catalog_items')
        .select(SELECT)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
    if (!includeInactive) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) throw error;
    return ((data || []) as RawRow[]).map(mapRow);
}

export async function createCatalogItem(
    supabase: SupabaseClient,
    input: CatalogItemInput
): Promise<CatalogItem> {
    const { data, error } = await supabase
        .from('catalog_items')
        .insert(toRow(input))
        .select(SELECT)
        .single();
    if (error) throw error;
    return mapRow(data as RawRow);
}

export async function updateCatalogItem(
    supabase: SupabaseClient,
    id: string,
    input: CatalogItemInput
): Promise<CatalogItem> {
    const { data, error } = await supabase
        .from('catalog_items')
        .update(toRow(input))
        .eq('id', id)
        .select(SELECT)
        .single();
    if (error) throw error;
    return mapRow(data as RawRow);
}

export async function deleteCatalogItem(
    supabase: SupabaseClient,
    id: string
): Promise<void> {
    const { error } = await supabase.from('catalog_items').delete().eq('id', id);
    if (error) throw error;
}

// Reuses the same public bucket as products since permissions are the
// same (admin uploads, everyone can read). Keeps ops simple: one bucket
// to configure, one place to look when hunting a broken image URL.
export async function uploadCatalogImage(
    supabase: SupabaseClient,
    file: File
): Promise<string> {
    const ext = file.name.split('.').pop() || 'png';
    const path = `catalog/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
        .from('product-images')
        .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'image/png'
        });
    if (error) throw error;
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
}
