import { createClient } from '@/utils/supabase/server';
import { fetchCompanies } from '@/lib/services/companies';
import { CompaniesManager } from '@/components/admin/companies-manager';

export default async function AdminCompaniesPage() {
    const supabase = await createClient();
    const companies = await fetchCompanies(supabase);
    return <CompaniesManager initialCompanies={companies} />;
}
