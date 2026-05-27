import { createClient } from '@/utils/supabase/server';
import { fetchStationUsers } from '@/lib/services/station-users';
import { StationUsersManager } from '@/components/admin/station-users-manager';

export default async function StationUsersPage() {
    const supabase = await createClient();
    const users = await fetchStationUsers(supabase);
    return <StationUsersManager initialUsers={users} />;
}
