import { createClient } from '@/utils/supabase/server';
import { fetchProducts } from '@/lib/services/products';
import { fetchCompanies } from '@/lib/services/companies';
import { ProductsManager } from '@/components/admin/products-manager';

export default async function AdminProductsPage() {
    const supabase = await createClient();
    const [products, companies] = await Promise.all([
        fetchProducts(supabase),
        fetchCompanies(supabase)
    ]);
    return <ProductsManager initialProducts={products} companies={companies} />;
}
