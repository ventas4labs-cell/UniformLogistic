import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { CartProvider } from '@/components/cart-provider';
import { CartDrawer } from '@/components/cart-drawer';
import { PortalNav } from '@/components/customer/portal-nav';
import { fetchStationUser } from '@/lib/services/station-users';
import { fetchEmployee } from '@/lib/services/employees';

// Hard-coded admin gate — same value used in app/(app)/home/page.tsx and the
// admin-route protection. Lives here too so the customer-shell PortalNav can
// point its Panel entry back at /admin for the admin user (instead of the
// customer warehouse dashboard at /home).
const ADMIN_EMAIL = 'ulogisticcr@gmail.com';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const isAdmin = (user.email || '').trim().toLowerCase() === ADMIN_EMAIL;

    // External station users (corte / maquila / bordado / …) get the
    // restricted /station shell — they shouldn't see the customer
    // catalog or any other company data. Admin is exempted.
    if (!isAdmin) {
        const station = await fetchStationUser(supabase, user.id);
        if (station) redirect('/station');
        // Employees (HR module) get their own restricted /empleado shell.
        const employee = await fetchEmployee(supabase, user.id);
        if (employee) redirect('/empleado');
    }

    // Already on the session — no query needed to name the company in
    // the sidebar.
    const companyName =
        (user.user_metadata?.company_name as string | undefined) || undefined;

    return (
        <CartProvider>
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 transition-colors">
                <PortalNav companyName={companyName} isAdmin={isAdmin} />
                <div className="lg:pl-64">
                    <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
                        {children}
                    </main>
                </div>
                <CartDrawer />
            </div>
        </CartProvider>
    );
}
