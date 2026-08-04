'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus, Pin, PinOff, Check, Settings2 } from 'lucide-react';
import { ADMIN_ACTIONS } from '@/components/admin/admin-actions';
import {
    FAST_ACTIONS_COOKIE,
    FAST_ACTIONS_EVENT,
    serializeFastActions
} from '@/lib/admin-fast-actions';
import { openQuickCreate } from '@/lib/admin-quick-create';

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

// The home-page "Acciones rápidas" launcher. Each curated action is a
// tile that navigates on tap. Pinning (add to the top-bar fast actions)
// lives behind an explicit "Personalizar" mode, so in normal use each
// tile is a single full-size tap target with no overlapping control to
// mis-hit on the floor. Orange is reserved for the one primary "create"
// action; every other tile is neutral, so the accent still means "act".
export function QuickActionsPanel({ initialPinned, badges }: Props) {
    const [pinned, setPinned] = useState<string[]>(initialPinned);
    const [customizing, setCustomizing] = useState(false);

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
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Acciones rápidas
                </h2>
                <button
                    type="button"
                    onClick={() => setCustomizing((c) => !c)}
                    aria-pressed={customizing}
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold transition-colors ${
                        customizing
                            ? 'bg-orange-600 text-white hover:bg-orange-700'
                            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                >
                    {customizing ? <Check size={14} /> : <Settings2 size={14} />}
                    {customizing ? 'Listo' : 'Personalizar'}
                </button>
            </div>

            {customizing && (
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-1.5">
                    <Pin size={13} /> Tocá una acción para fijarla o quitarla de la
                    barra superior.
                </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {ADMIN_ACTIONS.map((a) => {
                    const isPinned = pinned.includes(a.id);
                    const TileIcon = a.primary ? Plus : a.Icon;
                    const badge =
                        a.badgeKey === 'invoicesToPay' ? badges?.invoicesToPay : undefined;

                    // Chip: orange only for the primary create action; every
                    // other tile carries a neutral chip so orange keeps meaning
                    // "this is the headline action".
                    const chipCls = a.primary
                        ? 'bg-white/20 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300';

                    const baseTile = a.primary
                        ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-sm shadow-orange-600/20'
                        : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-orange-300 dark:hover:border-orange-500/40 hover:text-orange-700 dark:hover:text-orange-300 shadow-sm';

                    const tileCls = `relative flex flex-col items-center justify-center gap-2 rounded-2xl p-4 min-h-[6.25rem] text-center font-bold text-sm transition-all h-full w-full ${baseTile} ${
                        customizing && isPinned
                            ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-zinc-100 dark:ring-offset-zinc-950'
                            : ''
                    }`;

                    const tileInner = (
                        <>
                            {badge !== undefined && badge > 0 && (
                                <span className="absolute top-2 left-2 min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-extrabold flex items-center justify-center">
                                    {badge}
                                </span>
                            )}
                            {/* Pin state indicator — only in customize mode */}
                            {customizing && (
                                <span
                                    className={`absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center ${
                                        isPinned
                                            ? a.primary
                                                ? 'bg-white text-orange-600'
                                                : 'bg-orange-600 text-white'
                                            : a.primary
                                              ? 'bg-white/25 text-white'
                                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
                                    }`}
                                >
                                    {isPinned ? <Pin size={13} /> : <PinOff size={13} />}
                                </span>
                            )}
                            <span
                                className={`w-9 h-9 rounded-xl flex items-center justify-center ${chipCls}`}
                            >
                                <TileIcon size={18} />
                            </span>
                            {a.label}
                        </>
                    );

                    // In customize mode every tile is a pin toggle. In normal
                    // mode it navigates (or pops the quick-create modal).
                    if (customizing) {
                        return (
                            <button
                                key={a.id}
                                type="button"
                                onClick={() => togglePin(a.id)}
                                aria-pressed={isPinned}
                                title={
                                    isPinned
                                        ? 'Quitar de la barra superior'
                                        : 'Fijar en la barra superior'
                                }
                                className={tileCls}
                            >
                                {tileInner}
                            </button>
                        );
                    }

                    return a.quickCreate ? (
                        <button
                            key={a.id}
                            type="button"
                            onClick={() => openQuickCreate(a.quickCreate!)}
                            className={tileCls}
                        >
                            {tileInner}
                        </button>
                    ) : (
                        <Link key={a.id} href={a.href} className={tileCls}>
                            {tileInner}
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
