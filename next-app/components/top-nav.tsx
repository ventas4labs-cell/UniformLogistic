'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Home, LogOut, ShoppingCart } from 'lucide-react';
import { useCart } from '@/components/cart-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { signOutAction } from '@/app/login/actions';

const TITLES: Record<string, string> = {
    '/catalog': 'Catálogo',
    '/cart': 'Carrito',
    '/checkout': 'Finalizar',
    '/orders': 'Historial',
    '/stock': 'Stock',
    '/cuentas': 'Cuentas',
};

export function TopNav() {
    const pathname = usePathname() || '';
    const router = useRouter();
    const { cart } = useCart();

    // Hide nav on landing / success / admin routes
    if (
        pathname === '/home' ||
        pathname === '/success' ||
        pathname.startsWith('/admin')
    ) {
        return null;
    }

    const title = Object.entries(TITLES).find(([p]) => pathname.startsWith(p))?.[1];
    if (!title) return null;

    const showBack = pathname !== '/catalog';

    return (
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 transition-colors">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {showBack && (
                        <button
                            onClick={() => router.back()}
                            className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-zinc-700 dark:hover:text-white transition-all active:scale-90"
                            aria-label="Volver"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h1 className="font-extrabold text-2xl tracking-tight text-zinc-900 dark:text-zinc-100">
                        {title}
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <Link
                        href="/home"
                        className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-zinc-700 dark:hover:text-white transition-all active:scale-90"
                        title="Inicio"
                    >
                        <Home size={20} />
                    </Link>
                    <Link
                        href="/cart"
                        className="relative p-2.5 bg-zinc-900 dark:bg-orange-600 rounded-xl text-white hover:bg-orange-600 dark:hover:bg-orange-500 transition-all shadow-lg active:scale-95 group"
                    >
                        <ShoppingCart size={20} />
                        {cart.length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-zinc-950 group-hover:scale-110 transition-transform">
                                {cart.length}
                            </span>
                        )}
                    </Link>
                    <form action={signOutAction}>
                        <button
                            type="submit"
                            className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-all active:scale-90"
                            title="Cerrar sesión"
                            aria-label="Cerrar sesión"
                        >
                            <LogOut size={20} />
                        </button>
                    </form>
                </div>
            </div>
        </header>
    );
}
