'use client';

import { useEffect, useRef } from 'react';

/**
 * Minimal dialog semantics for the app's modal overlays.
 *
 * Usage: `const dialogRef = useDialog(onClose)` and spread on the modal
 * PANEL element (not the backdrop):
 *
 *   <div ref={dialogRef} role="dialog" aria-modal="true"
 *        aria-label="…" tabIndex={-1} className="… outline-none">
 *
 * - Moves focus into the panel once on mount, so keyboard and
 *   screen-reader users land inside the dialog.
 * - When `onClose` is provided, Escape closes the dialog. Pass nothing
 *   for data-entry modals where a stray Escape could discard work.
 *
 * The listener is mount-stable and reads the latest `onClose` through a
 * ref, so inline-arrow callers don't re-run the effect (which would
 * steal focus from inputs inside the dialog on every parent render).
 */
export function useDialog(onClose?: () => void) {
    const ref = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    useEffect(() => {
        ref.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeRef.current?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    return ref;
}
