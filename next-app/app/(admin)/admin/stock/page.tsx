import { createClient } from '@/utils/supabase/server';
import { fetchAllStockGroupedByCompany } from '@/lib/services/stock';
import { AdminStockBoard } from '@/components/admin/admin-stock-board';

export default async function AdminStockPage() {
    const supabase = await createClient();
    const groups = await fetchAllStockGroupedByCompany(supabase);
    return <AdminStockBoard groups={groups} />;
}
