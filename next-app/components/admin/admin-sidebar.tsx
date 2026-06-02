'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
    LogOut,
    X,
    ClipboardList,
    Building2,
    Package,
    Users,
    ArrowLeft,
    Receipt,
    Boxes,
    Wallet,
    HardHat,
    ChevronDown,
    ChevronRight,
    Scissors,
    Factory,
    Printer,
    Sparkles,
    PackageCheck,
    PenTool,
    Sticker
} from 'lucide-react';
import { signOutAction } from '@/app/login/actions';
import { ThemeToggle } from '@/components/theme-toggle';

type Tab = { href: string; label: string; icon: React.ReactNode };

const TABS: Tab[] = [
    { href: '/admin/orders',         label: 'Pedidos',        icon: <ClipboardList size={20} /> },
    { href: '/admin/stock',          label: 'Stock',          icon: <Boxes size={20} /> },
    { href: '/admin/cuentas',        label: 'Cuentas',        icon: <Wallet size={20} /> },
    { href: '/admin/companies',      label: 'Empresas',       icon: <Building2 size={20} /> },
    { href: '/admin/products',       label: 'Productos',      icon: <Package size={20} /> },
    { href: '/admin/logos',          label: 'Logos',          icon: <Sticker size={20} /> },
    { href: '/admin/users',          label: 'Usuarios',       icon: <Users size={20} /> },
    { href: '/admin/station-users',  label: 'Estaciones',     icon: <HardHat size={20} /> },
    { href: '/admin/facturacion',    label: 'Facturación',    icon: <Receipt size={20} /> }
];

const OPERATIONS_TABS: Tab[] = [
    { href: '/admin/operador',  label: 'Bodega',    icon: <Package size={16} /> },
    { href: '/admin/corte',     label: 'Corte',     icon: <Scissors size={16} /> },
    { href: '/admin/maquila',   label: 'Maquila',   icon: <Factory size={16} /> },
    { href: '/admin/impresion', label: 'Impresión', icon: <Printer size={16} /> },
    { href: '/admin/bordado',   label: 'Bordado',   icon: <Sparkles size={16} /> },
    { href: '/admin/empaque',   label: 'Empaque',   icon: <PackageCheck size={16} /> },
    { href: '/admin/ploter',    label: 'Ploter',    icon: <PenTool size={16} /> }
];

interface SidebarProps {
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

export function AdminSidebar({ mobileOpen = false, onMobileClose }: SidebarProps = {}) {
    const pathname = usePathname();
    const operationsActive = OPERATIONS_TABS.some(
        (t) => pathname === t.href || pathname?.startsWith(t.href + '/')
    );
    // Keep the Operations group expanded whenever the user is on one of
    // its routes. Manual toggle is allowed on other routes.
    const [operationsOpen, setOperationsOpen] = useState(operationsActive);
    useEffect(() => {
        if (operationsActive) setOperationsOpen(true);
    }, [operationsActive]);

    return (
        <aside
            className={`w-64 bg-gray-900 text-white flex flex-col fixed inset-y-0 left-0 z-30 transition-transform duration-200 ${
                mobileOpen
                    ? 'translate-x-0'
                    : '-translate-x-full lg:translate-x-0'
            }`}
            aria-hidden={!mobileOpen ? undefined : false}
        >
            <div className="p-6 border-b border-white/10 flex items-start justify-between gap-2">
                <div>
                    <h1 className="text-lg font-extrabold tracking-tight">Uniform Logistic</h1>
                    <p className="text-xs text-gray-400 mt-1">Panel de Administración</p>
                </div>
                {onMobileClose && (
                    <button
                        type="button"
                        onClick={onMobileClose}
                        aria-label="Cerrar menú"
                        className="lg:hidden -m-2 p-2 rounded-lg text-gray-300 hover:bg-white/10 shrink-0"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>

            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                {/* Pedidos */}
                <SidebarLink tab={TABS[0]} pathname={pathname} />

                {/* Operations expandable group */}
                <button
                    type="button"
                    onClick={() => setOperationsOpen((o) => !o)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                        operationsActive
                            ? 'bg-orange-600/20 text-white'
                            : 'text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                >
                    <HardHat size={20} />
                    <span className="flex-1 text-left">Operations</span>
                    {operationsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {operationsOpen && (
                    <div className="ml-3 pl-3 border-l border-white/10 space-y-1">
                        {OPERATIONS_TABS.map((t) => {
                            const active =
                                pathname === t.href || pathname?.startsWith(t.href + '/');
                            return (
                                <Link
                                    key={t.href}
                                    href={t.href}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                                        active
                                            ? 'bg-orange-600 text-white shadow-md font-bold'
                                            : 'text-gray-300 hover:bg-white/10 hover:text-white font-medium'
                                    }`}
                                >
                                    {t.icon}
                                    <span>{t.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                )}

                {/* Everything else */}
                {TABS.slice(1).map((t) => (
                    <SidebarLink key={t.href} tab={t} pathname={pathname} />
                ))}
            </nav>

            <div className="p-4 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between gap-2 px-1">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                        Tema
                    </span>
                    <ThemeToggle />
                </div>
                <Link
                    href="/home"
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                    <ArrowLeft size={18} />
                    Volver a la App
                </Link>
                <form action={signOutAction}>
                    <button
                        type="submit"
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                        <LogOut size={18} />
                        Cerrar Sesión
                    </button>
                </form>
            </div>
        </aside>
    );
}

function SidebarLink({ tab, pathname }: { tab: Tab; pathname: string | null }) {
    const active = pathname === tab.href || pathname?.startsWith(tab.href + '/');
    return (
        <Link
            href={tab.href}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                active
                    ? 'bg-orange-600 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
        >
            {tab.icon}
            <span className="flex-1">{tab.label}</span>
        </Link>
    );
}
