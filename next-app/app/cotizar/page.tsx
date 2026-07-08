import type { Metadata } from 'next';
import { createServiceClient } from '@/utils/supabase/server';
import { fetchCatalogItems } from '@/lib/services/catalog-items';
import { QuoteConfigurator } from '@/components/cotizar/quote-configurator';

export const metadata: Metadata = {
    title: 'Cotizá tus uniformes — Uniform Logistic',
    description:
        'Armá tu cotización de uniformes en línea: elegí el producto, la tela, el color y la cantidad de logos, y recibí el precio al instante.'
};

// Always render fresh so catalog edits in the admin show up immediately;
// the page is public and reads via the service client (RLS-bypassing,
// server-only) so logged-out visitors can browse the catalog.
export const dynamic = 'force-dynamic';

export default async function CotizarPage() {
    const supabase = createServiceClient();
    const catalog = await fetchCatalogItems(supabase);
    return <QuoteConfigurator catalog={catalog} />;
}
