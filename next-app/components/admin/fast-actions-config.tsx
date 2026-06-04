'use client';

import { useState } from 'react';
import { Check, Zap } from 'lucide-react';
import { ADMIN_MODULES } from '@/components/admin/admin-modules';
import {
    FAST_ACTIONS_COOKIE,
    FAST_ACTIONS_EVENT,
    serializeFastActions
} from '@/lib/admin-fast-actions';

const YEAR = 60 * 60 * 24 * 365;

// Persist the choice to a cookie (so the server shell renders the fast
// actions on the next load with no flash) and broadcast it so the top
// bar updates live. Module-scope so the cookie write isn't a mutation
// inside the component body.
function persistFastActions(next: string[]) {
    document.cookie = `${FAST_ACTIONS_COOKIE}=${serializeFastActions(
        next
    )}; path=/; max-age=${YEAR}; samesite=lax`;
    window.dispatchEvent(new CustomEvent(FAST_ACTIONS_EVENT, { detail: next }));
}

// Lets the admin pick which modules appear as fast actions in the top
// bar. 'home' is excluded — pinning it is pointless and the fast
// actions hide on the home module anyway.
export function FastActionsConfig({ initial }: { initial: string[] }) {
    const [selected, setSelected] = useState<string[]>(initial);

    const options = ADMIN_MODULES.filter((m) => m.id !== 'home');

    const toggle = (id: string) => {
        setSelected((prev) => {
            const next = prev.includes(id)
                ? prev.filter((x) => x !== id)
                : [...prev, id];
            persistFastActions(next);
            return next;
        });
    };

    return (
        <section>
            <div className="flex items-center gap-2 mb-1">
                <Zap size={16} className="text-orange-600 dark:text-orange-400" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                    Acciones rápidas
                </h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-3">
                Elegí los módulos que querés tener a un clic en la barra superior.
                No se muestran acá en Inicio.
                {selected.length > 0 && (
                    <span className="ml-1 font-semibold text-gray-700 dark:text-zinc-300">
                        {selected.length} seleccionado{selected.length === 1 ? '' : 's'}.
                    </span>
                )}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {options.map((m) => {
                    const on = selected.includes(m.id);
                    const Icon = m.Icon;
                    return (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => toggle(m.id)}
                            aria-pressed={on}
                            className={`relative flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                                on
                                    ? 'border-orange-300 dark:border-orange-500/50 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200'
                                    : 'border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 hover:border-orange-200 dark:hover:border-orange-500/30'
                            }`}
                        >
                            <span
                                className={
                                    on
                                        ? 'text-orange-600 dark:text-orange-400'
                                        : 'text-gray-400 dark:text-zinc-500'
                                }
                            >
                                <Icon size={18} />
                            </span>
                            <span className="flex-1 min-w-0 truncate">{m.label}</span>
                            <span
                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                                    on
                                        ? 'bg-orange-600 text-white'
                                        : 'border border-gray-300 dark:border-zinc-600'
                                }`}
                            >
                                {on && <Check size={13} strokeWidth={3} />}
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
