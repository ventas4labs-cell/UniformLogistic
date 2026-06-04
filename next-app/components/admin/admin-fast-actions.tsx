'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { actionById } from '@/components/admin/admin-actions';
import { FAST_ACTIONS_EVENT } from '@/lib/admin-fast-actions';
import { openQuickCreate } from '@/lib/admin-quick-create';

// Configurable one-click buttons in the admin top bar. Initial set is
// read server-side (from the cookie) and passed in so there's no flash;
// the config panel in the home module dispatches FAST_ACTIONS_EVENT so
// these update live without a reload. Hidden while on the home module
// (that's where they're configured).
export function AdminFastActions({ initial }: { initial: string[] }) {
    const pathname = usePathname();
    const [ids, setIds] = useState<string[]>(initial);

    useEffect(() => {
        const onChange = (e: Event) => {
            const detail = (e as CustomEvent<string[]>).detail;
            if (Array.isArray(detail)) setIds(detail);
        };
        window.addEventListener(FAST_ACTIONS_EVENT, onChange);
        return () => window.removeEventListener(FAST_ACTIONS_EVENT, onChange);
    }, []);

    // Hide on the home module — that's the configuration surface.
    if (pathname === '/admin/home') return null;

    const actions = ids.map(actionById).filter((a) => a !== undefined);
    if (actions.length === 0) return null;

    return (
        <div className="ml-auto flex items-center gap-1.5 overflow-x-auto">
            {actions.map((a) => {
                const action = a!;
                const active =
                    pathname === action.href ||
                    pathname?.startsWith(action.href + '/');
                const Icon = action.Icon;
                const cls = `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold shrink-0 transition-colors ${
                    active
                        ? 'bg-orange-600 text-white'
                        : action.primary
                          ? 'text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30'
                          : 'text-gray-600 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:text-orange-700 dark:hover:text-orange-300'
                }`;
                const inner = (
                    <>
                        <Icon size={16} />
                        <span className="hidden md:inline">{action.label}</span>
                    </>
                );
                // Create actions pop a modal in place instead of navigating.
                if (action.quickCreate) {
                    return (
                        <button
                            key={action.id}
                            type="button"
                            title={action.label}
                            onClick={() => openQuickCreate(action.quickCreate!)}
                            className={cls}
                        >
                            {inner}
                        </button>
                    );
                }
                return (
                    <Link
                        key={action.id}
                        href={action.href}
                        title={action.label}
                        className={cls}
                    >
                        {inner}
                    </Link>
                );
            })}
        </div>
    );
}
