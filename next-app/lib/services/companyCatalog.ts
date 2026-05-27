import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '@/lib/types';
import { AdminProduct, BomItem, mapProductRow, ProductRow } from './products';

interface ProductWithCompanyLinks extends ProductRow {
    links: { id: string; company_id: string }[];
}

// Re-declare since ProductRow is exported but sizes_json uses Product['sizes']
// which is fine. The `links` field comes from the join.
export interface CatalogProductForCompany extends AdminProduct {
    isAssigned: boolean;
}

export const fetchCatalogForCompany = async (
    supabase: SupabaseClient,
    companyId: string
): Promise<CatalogProductForCompany[]> => {
    const { data, error } = await supabase
        .from('products')
        .select(
            `
            id, product_code, name, description, image_url,
            product_type, type_label, gender, sizes_json, fabric_type, is_active, bom_json, codigo_cabys,
            links:company_products ( id, company_id )
        `
        )
        .order('product_type', { ascending: true })
        .order('name', { ascending: true });
    if (error) throw error;

    return (data as unknown as ProductWithCompanyLinks[]).map((row) => {
        const product = mapProductRow(row);
        const isAssigned = (row.links || []).some(
            (l) => l.company_id === companyId
        );
        return { ...product, isAssigned };
    });
};

export const setProductAssignment = async (
    supabase: SupabaseClient,
    companyId: string,
    productUuid: string,
    assigned: boolean
): Promise<void> => {
    if (assigned) {
        const { error } = await supabase
            .from('company_products')
            .insert({
                company_id: companyId,
                product_id: productUuid,
                is_active: true
            });
        if (error && !/duplicate/i.test(error.message)) throw error;
    } else {
        const { error } = await supabase
            .from('company_products')
            .delete()
            .eq('company_id', companyId)
            .eq('product_id', productUuid);
        if (error) throw error;
    }
};

// Touch unused imports for tree-shaking suppression
export type { BomItem, Product };
