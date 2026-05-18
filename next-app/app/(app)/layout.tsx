import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { CartProvider } from '@/components/cart-provider';
import { TopNav } from '@/components/top-nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    return (
        <CartProvider>
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 transition-colors">
                <TopNav />
                <main className="mx-auto w-full max-w-7xl px-4 lg:px-8 py-6">
                    {children}
                </main>
            </div>
        </CartProvider>
    );
}
