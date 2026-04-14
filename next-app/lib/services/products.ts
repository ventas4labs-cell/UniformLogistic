import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product, ProductType } from '@/lib/types';

export interface BomItem {
    name: string;
    qty: number;
}

export interface ProductRow {
    id: string;
    product_code: string;
    name: string;
    description: string | null;
    image_url: string | null;
    product_type: 'shirt' | 'pant';
    gender: 'men' | 'women' | 'unisex';
    sizes_json: Product['sizes'] | null;
    fabric_type: string | null;
    is_active: boolean | null;
    bom_json: BomItem[] | null;
}

export interface AdminProduct extends Product {
    uuid: string;
    fabricType: string;
    isActive: boolean;
    bom: BomItem[];
}

const genderToCategory = (gender: ProductRow['gender']): Product['category'] => {
    if (gender === 'men') return 'Men';
    if (gender === 'women') return 'Women';
    return 'Unisex';
};

export const mapProductRow = (row: ProductRow): AdminProduct => ({
    id: row.product_code,
    uuid: row.id,
    name: row.name,
    type: row.product_type as ProductType,
    image: row.image_url || '',
    description: row.description || '',
    category: genderToCategory(row.gender),
    sizes: row.sizes_json || {},
    fabricType: row.fabric_type || '',
    isActive: row.is_active !== false,
    bom: (row.bom_json as BomItem[]) || []
});

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

    const { data, error } = await supabase
        .from('company_products')
        .select(`
            product:products (
                id, product_code, name, description, image_url,
                product_type, gender, sizes_json, fabric_type, is_active, bom_json
            )
        `)
        .eq('company_id', link.company_id)
        .eq('is_active', true);
    if (error) throw error;

    return (data || [])
        .map((row: { product: ProductRow | ProductRow[] | null }) =>
            Array.isArray(row.product) ? row.product[0] : row.product
        )
        .filter((p): p is ProductRow => Boolean(p))
        .filter((p) => p.is_active !== false)
        .map(mapProductRow);
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
    gender: 'men' | 'women' | 'unisex';
    sizes: Product['sizes'];
    fabricType?: string;
    isActive?: boolean;
    bom?: BomItem[];
}

const PRODUCT_SELECT =
    'id, product_code, name, description, image_url, product_type, gender, sizes_json, fabric_type, is_active, bom_json';

export const fetchProducts = async (
    supabase: SupabaseClient
): Promise<AdminProduct[]> => {
    const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .order('product_type', { ascending: true })
        .order('name', { ascending: true });
    if (error) throw error;
    return (data as ProductRow[]).map(mapProductRow);
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
            gender: input.gender,
            sizes_json: input.sizes,
            fabric_type: input.fabricType || null,
            is_active: input.isActive ?? true,
            bom_json: input.bom || []
        })
        .select(PRODUCT_SELECT)
        .single();
    if (error) throw error;
    return mapProductRow(data as ProductRow);
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
            gender: input.gender,
            sizes_json: input.sizes,
            fabric_type: input.fabricType || null,
            is_active: input.isActive ?? true,
            bom_json: input.bom || []
        })
        .eq('id', uuid)
        .select(PRODUCT_SELECT)
        .single();
    if (error) throw error;
    return mapProductRow(data as ProductRow);
};

export const deleteProduct = async (
    supabase: SupabaseClient,
    uuid: string
): Promise<void> => {
    const { error } = await supabase.from('products').delete().eq('id', uuid);
    if (error) throw error;
};
