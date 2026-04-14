'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Home, ShoppingCart } from 'lucide-react';
import { useCart } from '@/components/cart-provider';

const TITLES: Record<string, string> = {
    '/catalog': 'Catálogo',
    '/cart': 'Carrito',
    '/checkout': 'Finalizar',
    '/orders': 'Historial',
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
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {showBack && (
                        <button
                            onClick={() => router.back()}
                            className="p-2.5 bg-zinc-100 rounded-xl text-zinc-600 hover:bg-orange-50 hover:text-orange-600 transition-all active:scale-90"
                            aria-label="Volver"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h1 className="font-extrabold text-2xl tracking-tight text-zinc-900">
                        {title}
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/home"
                        className="p-2.5 bg-zinc-100 rounded-xl text-zinc-600 hover:bg-orange-50 hover:text-orange-600 transition-all active:scale-90"
                        title="Inicio"
                    >
                        <Home size={20} />
                    </Link>
                    <Link
                        href="/cart"
                        className="relative p-2.5 bg-zinc-900 rounded-xl text-white hover:bg-orange-600 transition-all shadow-lg active:scale-95 group"
                    >
                        <ShoppingCart size={20} />
                        {cart.length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center ring-4 ring-white group-hover:scale-110 transition-transform">
                                {cart.length}
                            </span>
                        )}
                    </Link>
                </div>
            </div>
        </header>
    );
}
