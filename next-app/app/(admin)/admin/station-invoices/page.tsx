import { createClient } from '@/utils/supabase/server';
import { fetchAllStationInvoices } from '@/lib/services/station-invoices';
import { StationInvoicesTable } from '@/components/admin/station-invoices-table';

export default async function AdminStationInvoicesPage() {
    const supabase = await createClient();
    const invoices = await fetchAllStationInvoices(supabase);
    return <StationInvoicesTable initialInvoices={invoices} />;
}
