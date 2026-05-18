import { createClient } from '@/utils/supabase/server';
import { fetchAllStockGroupedByCompany } from '@/lib/services/stock';
import { fetchCompanies } from '@/lib/services/companies';
import { AdminStockBoard } from '@/components/admin/admin-stock-board';

export default async function AdminStockPage() {
    const supabase = await createClient();
    const [groups, companies] = await Promise.all([
        fetchAllStockGroupedByCompany(supabase),
        fetchCompanies(supabase)
    ]);
    return (
        <AdminStockBoard
            groups={groups}
            companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        />
    );
}
