import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

const ADMIN_EMAIL = 'ulogisticcr@gmail.com';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const email = (user.email || '').trim().toLowerCase();
    if (email !== ADMIN_EMAIL) redirect('/home');

    return (
        <div className="flex min-h-screen bg-gray-100 dark:bg-zinc-950 transition-colors">
            <AdminSidebar />
            <main className="flex-1 ml-64 p-8">
                <div className="max-w-6xl mx-auto">{children}</div>
            </main>
        </div>
    );
}
