'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Clock, QrCode } from 'lucide-react';

// The whole employee portal: punch by QR, review hours, request time
// off. Nothing here edits time — punches only come from a kiosk scan.
const TABS = [
    { href: '/empleado', label: 'Marcar', Icon: QrCode },
    { href: '/empleado/horas', label: 'Mis horas', Icon: Clock },
    { href: '/empleado/permisos', label: 'Permisos', Icon: CalendarDays }
];

export function EmployeeNav() {
    const pathname = usePathname();
    // /empleado/marcar (the QR landing) belongs to the Marcar tab.
    const isActive = (href: string) =>
        href === '/empleado'
            ? pathname === '/empleado' || pathname.startsWith('/empleado/marcar')
            : pathname.startsWith(href);

    return (
        <nav className="mx-auto w-full max-w-2xl px-4 flex gap-1" aria-label="Portal de empleado">
            {TABS.map(({ href, label, Icon }) => {
                const active = isActive(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                            active
                                ? 'border-orange-600 text-orange-700 dark:text-orange-400'
                                : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200'
                        }`}
                    >
                        <Icon size={16} />
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}
