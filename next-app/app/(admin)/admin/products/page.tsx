import { createClient } from '@/utils/supabase/server';
import { fetchProducts } from '@/lib/services/products';
import { ProductsManager } from '@/components/admin/products-manager';

export default async function AdminProductsPage() {
    const supabase = await createClient();
    const products = await fetchProducts(supabase);
    return <ProductsManager initialProducts={products} />;
}
