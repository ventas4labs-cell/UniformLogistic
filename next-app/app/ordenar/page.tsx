import type { Metadata } from 'next';
import { createServiceClient } from '@/utils/supabase/server';
import { fetchBasicProducts } from '@/lib/services/products';
import { FastOrderStudio } from '@/components/fast-order/fast-order-studio';

export const metadata: Metadata = {
    title: 'Hacé tu pedido — Uniform Logistic',
    description:
        'Elegí el producto, la talla, el color y la cantidad, dejanos tus datos y nosotros te contactamos para confirmar tu pedido de uniformes.'
};

// Always render fresh so product edits in the admin show up immediately;
// the page is public and reads via the service client (RLS-bypassing,
// server-only) so logged-out visitors can browse the basic products.
export const dynamic = 'force-dynamic';

export default async function OrdenarPage() {
    const supabase = createServiceClient();
    const products = await fetchBasicProducts(supabase);
    return <FastOrderStudio products={products} />;
}
