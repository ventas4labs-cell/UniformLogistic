import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { CartProvider } from '@/components/cart-provider';
import { CartDrawer } from '@/components/cart-drawer';
import { TopNav } from '@/components/top-nav';
import { fetchStationUser } from '@/lib/services/station-users';

// Hard-coded admin gate — same value used in app/(app)/home/page.tsx and the
// admin-route protection. Lives here too so the customer-shell TopNav can
// point the Home icon back at /admin for the admin user (instead of the
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
    }

    return (
        <CartProvider>
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 transition-colors">
                <TopNav isAdmin={isAdmin} />
                <main className="mx-auto w-full max-w-7xl px-4 lg:px-8 py-6">
                    {children}
                </main>
                <CartDrawer />
            </div>
        </CartProvider>
    );
}
