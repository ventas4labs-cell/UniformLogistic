import { createClient } from '@/utils/supabase/server';
import { fetchUserDirectory } from '@/lib/services/companyUsers';
import { fetchCompanies } from '@/lib/services/companies';
import { UsersManager } from '@/components/admin/users-manager';

export default async function AdminUsersPage() {
    const supabase = await createClient();
    const [users, companies] = await Promise.all([
        fetchUserDirectory(supabase),
        fetchCompanies(supabase)
    ]);
    return <UsersManager initialUsers={users} companies={companies} />;
}
