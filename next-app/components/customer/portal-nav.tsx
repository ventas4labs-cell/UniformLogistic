'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
    Boxes,
    ClipboardList,
    LayoutGrid,
    LogOut,
    Menu,
    Receipt,
    ShoppingCart,
    Store,
    X
} from 'lucide-react';
import { useCart } from '@/components/cart-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { signOutAction } from '@/app/login/actions';

// The customer portal's only navigation. A permanent rail on desktop, the
// same rail as an off-canvas drawer on phones — one component so the two
// can never drift apart. Grouped because six flat links give the customer
// no map of the portal: buying, tracking, and their company's standing
// are three different errands.

type IconType = React.ComponentType<{ size?: number; className?: string }>;

interface NavItem {
    href: string;
    label: string;
    Icon: IconType;
    /** Cart is the only count that changes without a reload. */
    badge?: 'cart';
}

// The admin reaches the customer shell through "place an order on behalf
// of" — their Panel entry has to lead back to the admin home, not to a
// customer dashboard they have no data for.
const groupsFor = (isAdmin: boolean): { label: string; items: NavItem[] }[] => [
    {
        label: 'Panel',
        items: [
            isAdmin
                ? { href: '/admin/home', label: 'Panel admin', Icon: LayoutGrid }
                : { href: '/home', label: 'Resumen', Icon: LayoutGrid }
        ]
    },
    {
        label: 'Pedidos',
        items: [
            { href: '/catalog', label: 'Catálogo', Icon: Store },
            { href: '/cart', label: 'Carrito', Icon: ShoppingCart, badge: 'cart' },
            { href: '/orders', label: 'Mis pedidos', Icon: ClipboardList }
        ]
    },
    {
        label: 'Mi empresa',
        items: [
            { href: '/stock', label: 'Bodega', Icon: Boxes },
            { href: '/cuentas', label: 'Cuentas', Icon: Receipt }
        ]
    }
];

const FLAT = groupsFor(false).flatMap((g) => g.items);

/** Longest-prefix match, so /checkout still reads as part of the cart. */
const EXTRA_TITLES: Record<string, string> = {
    '/checkout': 'Finalizar pedido',
    '/success': 'Pedido enviado'
};

function titleFor(pathname: string): string {
    for (const [href, label] of Object.entries(EXTRA_TITLES)) {
        if (pathname.startsWith(href)) return label;
    }
    const hit = FLAT.filter((i) => pathname.startsWith(i.href)).sort(
        (a, b) => b.href.length - a.href.length
    )[0];
    return hit?.label || 'Uniform Logistic';
}

const isActive = (pathname: string, href: string) =>
    href === '/home' ? pathname === '/home' : pathname.startsWith(href);

export function PortalNav({
    companyName,
    isAdmin = false
}: {
    companyName?: string;
    isAdmin?: boolean;
}) {
    const pathname = usePathname() || '';
    const groups = groupsFor(isAdmin);
    const { totalItems } = useCart();
    const [open, setOpen] = useState(false);
    const close = () => setOpen(false);

    // Escape closes it, and the page behind it stops scrolling.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [open]);

    return (
        <>
            {/* ── Mobile bar ───────────────────────────────────────── */}
            <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-3 bg-white/85 dark:bg-zinc-900/85 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label="Abrir menú"
                    aria-expanded={open}
                    aria-controls="portal-nav"
                    className="p-2 -ml-1 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                >
                    <Menu size={22} />
                </button>
                <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {titleFor(pathname)}
                </span>
                <Link
                    href="/cart"
                    aria-label={`Carrito, ${totalItems} pieza${totalItems === 1 ? '' : 's'}`}
                    className="relative ml-auto p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                >
                    <ShoppingCart size={20} />
                    {totalItems > 0 && (
                        <span className="absolute top-0.5 right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-zinc-900">
                            {totalItems}
                        </span>
                    )}
                </Link>
            </header>

            {/* ── Scrim ────────────────────────────────────────────── */}
            <div
                aria-hidden="true"
                onClick={close}
                className={`lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none ${
                    open ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
            />

            {/* ── The rail ─────────────────────────────────────────── */}
            <nav
                id="portal-nav"
                aria-label="Navegación principal"
                className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-64 flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-transform duration-200 ease-out motion-reduce:transition-none ${
                    open ? 'visible translate-x-0' : 'invisible -translate-x-full'
                } lg:visible lg:translate-x-0`}
            >
                <div className="flex items-center gap-3 h-16 px-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                    <Link
                        href={isAdmin ? '/admin/home' : '/home'}
                        onClick={close}
                        className="flex items-center gap-2.5 min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                    >
                        <span className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 ring-1 ring-black/5 dark:ring-white/10">
                            <Image src="/ul-logo.png" alt="" fill sizes="36px" className="object-cover" />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                                Uniform Logistic
                            </span>
                            {companyName && (
                                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                    {companyName}
                                </span>
                            )}
                        </span>
                    </Link>
                    <button
                        type="button"
                        onClick={close}
                        aria-label="Cerrar menú"
                        className="lg:hidden ml-auto p-2 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                    {groups.map((group) => (
                        <div key={group.label}>
                            <h2 className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                {group.label}
                            </h2>
                            <ul className="space-y-0.5">
                                {group.items.map(({ href, label, Icon, badge }) => {
                                    const active = isActive(pathname, href);
                                    const count = badge === 'cart' ? totalItems : 0;
                                    return (
                                        <li key={href}>
                                            <Link
                                                href={href}
                                                onClick={close}
                                                aria-current={active ? 'page' : undefined}
                                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                                                    active
                                                        ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-bold'
                                                        : 'font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                                                }`}
                                            >
                                                <Icon
                                                    size={18}
                                                    className={
                                                        active
                                                            ? ''
                                                            : 'text-zinc-500 dark:text-zinc-400'
                                                    }
                                                />
                                                <span className="truncate">{label}</span>
                                                {count > 0 && (
                                                    <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center">
                                                        {count}
                                                    </span>
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 p-3 flex items-center gap-2">
                    <ThemeToggle />
                    <form action={signOutAction} className="flex-1">
                        <button
                            type="submit"
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                        >
                            <LogOut size={18} />
                            Cerrar sesión
                        </button>
                    </form>
                </div>
            </nav>
        </>
    );
}
