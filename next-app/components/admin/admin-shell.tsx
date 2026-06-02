'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

interface Props {
    children: React.ReactNode;
}

// Mobile-first admin shell. The fixed sidebar lives off-canvas on
// narrow screens and is summoned via the top hamburger. On lg+ the
// sidebar is permanently visible and the hamburger disappears.
//
// The mobile nav auto-closes when the route changes so tapping a
// sidebar link drops the user on their destination instead of
// landing under an open drawer.
export function AdminShell({ children }: Props) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    // Lock body scroll while the drawer is open on mobile.
    useEffect(() => {
        if (mobileOpen) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = prev;
            };
        }
    }, [mobileOpen]);

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-zinc-950 transition-colors">
            <AdminSidebar
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />

            {/* Backdrop for the mobile drawer. */}
            {mobileOpen && (
                <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Cerrar menú"
                    className="lg:hidden fixed inset-0 z-20 bg-black/50 backdrop-blur-sm"
                />
            )}

            <main className="lg:ml-64">
                <div className="lg:hidden sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-gray-200 dark:border-zinc-800">
                    <button
                        type="button"
                        onClick={() => setMobileOpen(true)}
                        aria-label="Abrir menú"
                        className="p-2 -ml-2 rounded-lg text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                        <Menu size={22} />
                    </button>
                    <span className="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                        Uniform Logistic
                    </span>
                </div>

                <div className="p-4 sm:p-6 lg:p-8">
                    <div className="max-w-6xl mx-auto">{children}</div>
                </div>
            </main>
        </div>
    );
}
