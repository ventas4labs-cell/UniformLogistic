'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Tucks finished orders away underneath the pending ones instead of
 * letting the two mix in a single grid — collapsed by default so a
 * board full of completed work still reads as "what's left to do".
 *
 * Boards render it only when BOTH pending and completed rows are in the
 * current result set; a list that's entirely one or the other needs no
 * separation.
 */
export function CompletedSection({
    count,
    children
}: {
    count: number;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    if (count === 0) return null;
    return (
        <section className="mt-6">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="w-full inline-flex items-center gap-2 px-4 min-h-11 rounded-xl border border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-950/20 text-sm font-bold text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-950/40 transition-colors"
            >
                <CheckCircle2 size={16} />
                Completados
                <span className="min-w-[1.3rem] px-1 rounded-full bg-green-200 dark:bg-green-900/60 text-[11px] leading-5 text-green-900 dark:text-green-200">
                    {count}
                </span>
                <span className="ml-auto">
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
            </button>
            {open && <div className="mt-3">{children}</div>}
        </section>
    );
}
