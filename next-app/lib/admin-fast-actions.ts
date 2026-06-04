// Admin top-bar "fast actions" — the modules the admin pins for one-click
// access from the top bar. Persisted in a cookie so the server-rendered
// shell can paint them with no flash. Pure constants + (de)serializers
// here (no next/headers, no 'server-only') so both the client config
// panel and the server shell can import it.

export const FAST_ACTIONS_COOKIE = 'ul_admin_fast_actions';

// Window event the config panel dispatches so the top bar updates live
// without a reload after the admin toggles an action.
export const FAST_ACTIONS_EVENT = 'ul:fast-actions-changed';

// Shown the first time, before the admin has configured anything (cookie
// absent). Once they configure — even to an empty set — the cookie is
// written and this default no longer applies.
export const DEFAULT_FAST_ACTIONS: string[] = ['orders'];

// Cookie value is a comma-separated list of module ids (slugs, no special
// chars) so it round-trips without encoding.
export function parseFastActions(raw: string | undefined | null): string[] {
    if (raw == null) return [];
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

export function serializeFastActions(ids: string[]): string {
    return ids.join(',');
}

// Resolve the effective list: an absent cookie means "never configured"
// → default; a present cookie (even empty) means the admin's explicit
// choice.
export function resolveFastActions(raw: string | undefined | null): string[] {
    return raw == null ? DEFAULT_FAST_ACTIONS : parseFastActions(raw);
}
