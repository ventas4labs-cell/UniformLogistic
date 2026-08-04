import type { Metadata } from 'next';
import { createServiceClient } from '@/utils/supabase/server';
import { fetchCatalogItems } from '@/lib/services/catalog-items';
import { catalogItemToFastOrderProduct } from '@/lib/fast-order-catalog';
import { FastOrderStudio } from '@/components/fast-order/fast-order-studio';

export const metadata: Metadata = {
    title: 'Hacé tu pedido — Uniform Logistic',
    description:
        'Elegí el producto, la talla, el color y la cantidad, dejanos tus datos y nosotros te contactamos para confirmar tu pedido de uniformes.'
};

// Always render fresh so catalog edits in the admin show up immediately;
// the page is public and reads via the service client (RLS-bypassing,
// server-only) so logged-out visitors can browse the catalog.
export const dynamic = 'force-dynamic';

export default async function OrdenarPage() {
    const supabase = createServiceClient();
    // Same source as /cotizar: the Catálogo default (catalog_items),
    // adapted to the fast-order picker's product shape.
    const catalog = await fetchCatalogItems(supabase);
    const products = catalog.map(catalogItemToFastOrderProduct);
    return <FastOrderStudio products={products} />;
}
