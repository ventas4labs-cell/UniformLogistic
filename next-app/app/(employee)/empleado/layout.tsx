import { redirect } from 'next/navigation';
import { LogOut, Clock } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { fetchEmployee } from '@/lib/services/employees';
import { signOutAction } from '@/app/login/actions';

// ─── Restricted shell for employees (HR / time-tracking) ────────────
// Anyone reaching /empleado who isn't an active employees row is bounced.
// Admin, customers and stations have their own shells — fetchEmployee
// returns null for them (RLS self-read), so the redirect fires.
export default async function EmpleadoLayout({
    children
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const employee = await fetchEmployee(supabase, user.id);
    if (!employee) redirect('/home');
    if (!employee.isActive) redirect('/login');

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 transition-colors">
            <header className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800">
                <div className="mx-auto w-full max-w-2xl px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock size={18} className="text-orange-600 dark:text-orange-400" />
                        <span className="font-bold text-sm">{employee.fullName}</span>
                    </div>
                    <form action={signOutAction}>
                        <button
                            type="submit"
                            title="Cerrar sesión"
                            aria-label="Cerrar sesión"
                            className="p-2 text-gray-500 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                        >
                            <LogOut size={18} />
                        </button>
                    </form>
                </div>
            </header>
            <main className="mx-auto w-full max-w-2xl px-4 py-6">{children}</main>
        </div>
    );
}
