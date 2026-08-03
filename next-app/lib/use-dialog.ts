'use client';

import { useEffect, useRef } from 'react';

// Elements that can receive keyboard focus inside a dialog panel.
const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), ' +
    'select:not([disabled]), textarea:not([disabled]), ' +
    '[tabindex]:not([tabindex="-1"])';

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
 * - Traps Tab / Shift+Tab inside the panel: tabbing past the last
 *   focusable element wraps to the first and vice versa, so keyboard
 *   focus can't wander into the page behind the overlay.
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
            if (e.key === 'Escape') {
                closeRef.current?.();
                return;
            }
            if (e.key !== 'Tab') return;

            const panel = ref.current;
            if (!panel) return;

            // Visible focusable elements only (skips display:none tabs
            // etc.); keep whatever currently holds focus so the check
            // below stays coherent even for oddly-positioned elements.
            const nodes = Array.from(
                panel.querySelectorAll<HTMLElement>(FOCUSABLE)
            ).filter(
                (el) => el.offsetParent !== null || el === document.activeElement
            );
            if (nodes.length === 0) {
                e.preventDefault();
                panel.focus();
                return;
            }

            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            const active = document.activeElement;
            const inside = active instanceof Node && panel.contains(active);

            if (e.shiftKey) {
                if (!inside || active === first || active === panel) {
                    e.preventDefault();
                    last.focus();
                }
            } else if (!inside || active === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    return ref;
}
