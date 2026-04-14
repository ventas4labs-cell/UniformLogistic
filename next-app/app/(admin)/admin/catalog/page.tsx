import { createClient } from '@/utils/supabase/server';
import { fetchCompanies } from '@/lib/services/companies';
import { fetchCatalogForCompany } from '@/lib/services/companyCatalog';
import { CatalogManager } from '@/components/admin/catalog-manager';

interface Props {
    searchParams: Promise<{ company?: string }>;
}

export default async function AdminCatalogPage({ searchParams }: Props) {
    const { company } = await searchParams;
    const supabase = await createClient();
    const companies = await fetchCompanies(supabase);
    const selectedId = company || companies[0]?.id || '';
    const catalog = selectedId ? await fetchCatalogForCompany(supabase, selectedId) : [];

    return (
        <CatalogManager
            companies={companies}
            initialCatalog={catalog}
            selectedCompanyId={selectedId}
        />
    );
}
