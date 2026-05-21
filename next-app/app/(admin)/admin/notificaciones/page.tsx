import { createClient } from '@/utils/supabase/server';
import { fetchAllReports } from '@/lib/services/missing-insumos';
import { NotificationCenter } from '@/components/admin/notification-center';

export default async function NotificacionesPage() {
    const supabase = await createClient();
    const reports = await fetchAllReports(supabase);
    return <NotificationCenter initialReports={reports} />;
}
