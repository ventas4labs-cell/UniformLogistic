import { createClient } from '@/utils/supabase/server';
import { fetchAllInvoicesGroupedByCompany } from '@/lib/services/invoices';
import { AdminCuentasBoard } from '@/components/admin/admin-cuentas-board';

export default async function AdminCuentasPage() {
    const supabase = await createClient();
    const groups = await fetchAllInvoicesGroupedByCompany(supabase);
    return <AdminCuentasBoard groups={groups} />;
}
