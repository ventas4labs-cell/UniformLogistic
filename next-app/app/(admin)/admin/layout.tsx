import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { AdminShell } from '@/components/admin/admin-shell';

const ADMIN_EMAIL = 'ulogisticcr@gmail.com';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const email = (user.email || '').trim().toLowerCase();
    if (email !== ADMIN_EMAIL) redirect('/home');

    return <AdminShell>{children}</AdminShell>;
}
