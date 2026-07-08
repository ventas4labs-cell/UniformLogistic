import { createClient } from '@/utils/supabase/server';
import { fetchCatalogItems } from '@/lib/services/catalog-items';
import { DefaultCatalogManager } from '@/components/admin/default-catalog-manager';

export default async function CatalogoDefaultPage() {
    const supabase = await createClient();
    const items = await fetchCatalogItems(supabase, { includeInactive: true });
    return <DefaultCatalogManager initialItems={items} />;
}
