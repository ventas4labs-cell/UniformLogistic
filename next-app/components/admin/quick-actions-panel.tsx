'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus, Pin, PinOff } from 'lucide-react';
import { ADMIN_ACTIONS } from '@/components/admin/admin-actions';
import {
    FAST_ACTIONS_COOKIE,
    FAST_ACTIONS_EVENT,
    serializeFastActions
} from '@/lib/admin-fast-actions';

const YEAR = 60 * 60 * 24 * 365;

// Persist pinned ids to a cookie (so the server shell paints the top-bar
// fast actions on the next load with no flash) and broadcast so the top
// bar updates live. Module-scope so the cookie write isn't a mutation
// inside the component body.
function persistPinned(next: string[]) {
    document.cookie = `${FAST_ACTIONS_COOKIE}=${serializeFastActions(
        next
    )}; path=/; max-age=${YEAR}; samesite=lax`;
    window.dispatchEvent(new CustomEvent(FAST_ACTIONS_EVENT, { detail: next }));
}

interface Props {
    initialPinned: string[];
    /** Live counts for action badges (e.g. facturas a pagar). */
    badges?: { invoicesToPay?: number };
}

// The home-page "Acciones rápidas" launcher. Every curated action is a
// colorful tile that navigates on click; a small pin in the corner adds
// or removes it from the top-bar fast actions (which are hidden here on
// the home module).
export function QuickActionsPanel({ initialPinned, badges }: Props) {
    const [pinned, setPinned] = useState<string[]>(initialPinned);

    const togglePin = (id: string) => {
        setPinned((prev) => {
            const next = prev.includes(id)
                ? prev.filter((x) => x !== id)
                : [...prev, id];
            persistPinned(next);
            return next;
        });
    };

    return (
        <section>
            <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                    Acciones rápidas
                </h2>
                <span className="text-[11px] text-gray-400 dark:text-zinc-500 flex items-center gap-1">
                    <Pin size={12} /> fijá las que querés en la barra superior
                </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {ADMIN_ACTIONS.map((a) => {
                    const isPinned = pinned.includes(a.id);
                    const TileIcon = a.primary ? Plus : a.Icon;
                    const badge =
                        a.badgeKey === 'invoicesToPay' ? badges?.invoicesToPay : undefined;
                    return (
                        <div key={a.id} className="relative">
                            <Link
                                href={a.href}
                                className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center font-bold text-sm transition-all shadow-sm h-full ${
                                    a.primary
                                        ? 'bg-orange-600 text-white hover:bg-orange-700'
                                        : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-200 hover:border-orange-300 dark:hover:border-orange-500/40 hover:text-orange-700 dark:hover:text-orange-300'
                                }`}
                            >
                                {badge !== undefined && badge > 0 && (
                                    <span className="absolute top-2 left-2 min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-extrabold flex items-center justify-center">
                                        {badge}
                                    </span>
                                )}
                                <span
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                        a.primary
                                            ? 'bg-white/20'
                                            : 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400'
                                    }`}
                                >
                                    <TileIcon size={18} />
                                </span>
                                {a.label}
                            </Link>

                            <button
                                type="button"
                                onClick={() => togglePin(a.id)}
                                aria-pressed={isPinned}
                                title={
                                    isPinned
                                        ? 'Quitar de la barra superior'
                                        : 'Fijar en la barra superior'
                                }
                                className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                    isPinned
                                        ? a.primary
                                            ? 'bg-white text-orange-600'
                                            : 'bg-orange-600 text-white'
                                        : a.primary
                                          ? 'bg-white/20 text-white hover:bg-white/30'
                                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 hover:text-orange-600 dark:hover:text-orange-400'
                                }`}
                            >
                                {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
                            </button>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
