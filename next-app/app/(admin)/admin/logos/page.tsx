import { createClient } from '@/utils/supabase/server';
import { fetchLogos } from '@/lib/services/logos';
import { fetchCompanies } from '@/lib/services/companies';
import { LogosManager } from '@/components/admin/logos-manager';

export default async function AdminLogosPage() {
    const supabase = await createClient();
    const [logos, companies] = await Promise.all([
        fetchLogos(supabase),
        fetchCompanies(supabase)
    ]);
    return <LogosManager initialLogos={logos} companies={companies} />;
}
