import { createClient } from '@/utils/supabase/server';
import { fetchCatalogItems } from '@/lib/services/catalog-items';
import { QuoteBuilder } from '@/components/admin/quote-builder';

export default async function NuevoCotizadorPage() {
    const supabase = await createClient();
    const items = await fetchCatalogItems(supabase);
    return <QuoteBuilder catalog={items} />;
}
