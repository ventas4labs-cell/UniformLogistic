import { createClient } from '@/utils/supabase/server';
import { fetchAllStockGroupedByCompany } from '@/lib/services/stock';
import { fetchCompanies } from '@/lib/services/companies';
import { fetchWithdrawals } from '@/lib/services/stock-withdrawals';
import { AdminStockBoard } from '@/components/admin/admin-stock-board';
import { WithdrawalsQueue } from '@/components/admin/withdrawals-queue';

export default async function AdminStockPage() {
    const supabase = await createClient();
    const [groups, companies, withdrawals] = await Promise.all([
        fetchAllStockGroupedByCompany(supabase),
        fetchCompanies(supabase),
        fetchWithdrawals(supabase)
    ]);
    return (
        <>
            <WithdrawalsQueue withdrawals={withdrawals} />
            <AdminStockBoard
                groups={groups}
                companies={companies.map((c) => ({ id: c.id, name: c.name }))}
            />
        </>
    );
}
