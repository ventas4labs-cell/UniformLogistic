import { createClient } from '@/utils/supabase/server';
import { fetchProducts } from '@/lib/services/products';
import { fetchCompanies } from '@/lib/services/companies';
import { fetchLogos } from '@/lib/services/logos';
import { ProductsManager } from '@/components/admin/products-manager';

export default async function AdminProductsPage() {
    const supabase = await createClient();
    const [products, companies, logos] = await Promise.all([
        fetchProducts(supabase),
        fetchCompanies(supabase),
        fetchLogos(supabase)
    ]);
    return (
        <ProductsManager
            initialProducts={products}
            companies={companies}
            logos={logos}
        />
    );
}
