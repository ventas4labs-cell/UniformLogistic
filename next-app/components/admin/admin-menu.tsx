'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
    LogOut,
    X,
    Home,
    ClipboardList,
    Building2,
    Package,
    ArrowLeft,
    Receipt,
    Boxes,
    Wallet,
    HardHat,
    Scissors,
    Factory,
    Printer,
    Sparkles,
    PackageCheck,
    PenTool,
    Sticker,
    FileText
} from 'lucide-react';
import { signOutAction } from '@/app/login/actions';
import { ThemeToggle } from '@/components/theme-toggle';

type Tab = { href: string; label: string; icon: React.ReactNode };

const MAIN_TABS: Tab[] = [
    { href: '/admin/home',           label: 'Inicio',         icon: <Home size={22} /> },
    { href: '/admin/orders',         label: 'Pedidos',        icon: <ClipboardList size={22} /> },
    { href: '/admin/stock',          label: 'Stock',          icon: <Boxes size={22} /> },
    { href: '/admin/materials',      label: 'Materiales',     icon: <Package size={22} /> },
    { href: '/admin/cuentas',        label: 'Cuentas',        icon: <Wallet size={22} /> },
    { href: '/admin/companies',      label: 'Empresas',       icon: <Building2 size={22} /> },
    { href: '/admin/products',       label: 'Productos',      icon: <Package size={22} /> },
    { href: '/admin/logos',          label: 'Logos',          icon: <Sticker size={22} /> },
    { href: '/admin/station-users',  label: 'Estaciones',     icon: <HardHat size={22} /> },
    { href: '/admin/station-invoices', label: 'Facturas a pagar', icon: <FileText size={22} /> },
    { href: '/admin/facturacion',    label: 'Facturación',    icon: <Receipt size={22} /> }
];

const OPERATIONS_TABS: Tab[] = [
    { href: '/admin/operador',  label: 'Bodega',    icon: <Package size={22} /> },
    { href: '/admin/corte',     label: 'Corte',     icon: <Scissors size={22} /> },
    { href: '/admin/maquila',   label: 'Maquila',   icon: <Factory size={22} /> },
    { href: '/admin/impresion', label: 'Impresión', icon: <Printer size={22} /> },
    { href: '/admin/bordado',   label: 'Bordado',   icon: <Sparkles size={22} /> },
    { href: '/admin/empaque',   label: 'Empaque',   icon: <PackageCheck size={22} /> },
    { href: '/admin/ploter',    label: 'Ploter',    icon: <PenTool size={22} /> }
];

// Top-left logo button that doubles as the menu trigger. The square
// shows the "UL" monogram at rest; on hover (or while the launcher is
// open) it morphs into a 3×3 dot grid to signal it's a menu. Clicking
// opens an app-launcher popup with every module, freeing the page for
// a full-width module view (no permanent sidebar).
export function AdminMenu() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    // Hover open/close with a short close delay so moving the pointer
    // across the small gap between the logo button and the panel — or
    // briefly off an edge — doesn't dismiss the launcher.
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const openNow = () => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
        setOpen(true);
    };
    const scheduleClose = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => setOpen(false), 180);
    };
    useEffect(
        () => () => {
            if (closeTimer.current) clearTimeout(closeTimer.current);
        },
        []
    );

    // Close on route change so navigating from the launcher drops the
    // user on their destination instead of behind an open panel.
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // Escape to close + lock body scroll while open.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open]);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={openNow}
                onMouseEnter={openNow}
                onMouseLeave={scheduleClose}
                aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
                aria-expanded={open}
                className="group relative w-11 h-11 rounded-xl bg-zinc-900 dark:bg-zinc-800 text-white shadow-md ring-1 ring-black/5 dark:ring-white/10 hover:ring-orange-500/40 transition-all active:scale-95"
            >
                {/* Monogram (rest state) */}
                <span
                    className={`absolute inset-0 flex items-center justify-center font-extrabold tracking-tight text-orange-500 transition-opacity duration-200 ${
                        open ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'
                    }`}
                >
                    UL
                </span>
                {/* Dot grid (hover / open state) */}
                <span
                    className={`absolute inset-0 grid grid-cols-3 gap-[3px] place-content-center justify-items-center transition-opacity duration-200 ${
                        open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    aria-hidden
                >
                    {Array.from({ length: 9 }).map((_, i) => (
                        <span
                            key={i}
                            className="w-1 h-1 rounded-full bg-orange-400"
                        />
                    ))}
                </span>
            </button>

            {open && (
                <>
                    {/* Backdrop */}
                    <button
                        type="button"
                        aria-label="Cerrar menú"
                        onClick={() => setOpen(false)}
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Launcher panel */}
                    <div
                        role="menu"
                        onMouseEnter={openNow}
                        onMouseLeave={scheduleClose}
                        className="absolute left-0 top-full mt-2 z-50 w-[calc(100vw-2rem)] sm:w-[34rem] max-w-[34rem] max-h-[80vh] overflow-y-auto rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-4"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-sm font-extrabold text-gray-900 dark:text-zinc-100">
                                    Uniform Logistic
                                </p>
                                <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                                    Panel de administración
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Cerrar"
                                className="p-2 -m-2 rounded-lg text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <Section title="Principal" tabs={MAIN_TABS} pathname={pathname} />
                        <Section
                            title="Operaciones"
                            tabs={OPERATIONS_TABS}
                            pathname={pathname}
                        />

                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Link
                                    href="/catalog"
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                >
                                    <ArrowLeft size={16} />
                                    Ir a la tienda
                                </Link>
                                <form action={signOutAction}>
                                    <button
                                        type="submit"
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    >
                                        <LogOut size={16} />
                                        Salir
                                    </button>
                                </form>
                            </div>
                            <ThemeToggle />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function Section({
    title,
    tabs,
    pathname
}: {
    title: string;
    tabs: Tab[];
    pathname: string | null;
}) {
    return (
        <div className="mb-3 last:mb-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500 px-1 mb-1.5">
                {title}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {tabs.map((t) => {
                    const active =
                        pathname === t.href || pathname?.startsWith(t.href + '/');
                    return (
                        <Link
                            key={t.href}
                            href={t.href}
                            role="menuitem"
                            className={`flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-center transition-colors ${
                                active
                                    ? 'bg-orange-600 text-white shadow-sm'
                                    : 'text-gray-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:text-orange-700 dark:hover:text-orange-300'
                            }`}
                        >
                            <span
                                className={
                                    active
                                        ? 'text-white'
                                        : 'text-gray-500 dark:text-zinc-400'
                                }
                            >
                                {t.icon}
                            </span>
                            <span className="text-[11px] font-semibold leading-tight">
                                {t.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
