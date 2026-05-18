'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, ClipboardList, Building2, Package, Layers, Users, ArrowLeft, Receipt, Boxes, Wallet } from 'lucide-react';
import { signOutAction } from '@/app/login/actions';
import { ThemeToggle } from '@/components/theme-toggle';

const TABS: { href: string; label: string; icon: React.ReactNode }[] = [
    { href: '/admin/orders',      label: 'Pedidos',      icon: <ClipboardList size={20} /> },
    { href: '/admin/stock',       label: 'Stock',        icon: <Boxes size={20} /> },
    { href: '/admin/cuentas',     label: 'Cuentas',      icon: <Wallet size={20} /> },
    { href: '/admin/companies',   label: 'Empresas',     icon: <Building2 size={20} /> },
    { href: '/admin/products',    label: 'Productos',    icon: <Package size={20} /> },
    { href: '/admin/catalog',     label: 'Catálogo',     icon: <Layers size={20} /> },
    { href: '/admin/users',       label: 'Usuarios',     icon: <Users size={20} /> },
    { href: '/admin/facturacion', label: 'Facturación',  icon: <Receipt size={20} /> }
];

export function AdminSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 bg-gray-900 text-white flex flex-col fixed inset-y-0 left-0 z-30">
            <div className="p-6 border-b border-white/10">
                <h1 className="text-lg font-extrabold tracking-tight">Uniform Logistic</h1>
                <p className="text-xs text-gray-400 mt-1">Panel de Administración</p>
            </div>

            <nav className="flex-1 py-4 px-3 space-y-1">
                {TABS.map((t) => {
                    const active = pathname === t.href || pathname?.startsWith(t.href + '/');
                    return (
                        <Link
                            key={t.href}
                            href={t.href}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                                active
                                    ? 'bg-orange-600 text-white shadow-lg'
                                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            {t.icon}
                            {t.label}
                        </Link>
                    );
                })}
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
