'use client';

import { createContext, useCallback, useContext, useRef } from 'react';

// ─── Silent session recovery ─────────────────────────────────────────
// Long-lived kiosk screens (the station tablets) outlive their Supabase
// session. Without this, the first save after the token lapses just
// returned "No autenticado." and threw away the operator's input.
//
// A screen that knows how to re-authenticate itself wraps its subtree in
// a provider; anything inside can then call useSessionRecovery() and,
// on an auth failure, recover and retry instead of surfacing the error.
// Components outside a provider get null and keep their old behaviour,
// so this is additive — the admin boards are unaffected.

/** Returns true when the session was restored. */
type Recover = () => Promise<boolean>;

const SessionRecoveryContext = createContext<Recover | null>(null);

/** Does this error message mean "the session is gone"? */
export function isAuthError(message: string | undefined | null): boolean {
    return !!message && /no\s+autenticado/i.test(message);
}

export function StationSessionRecovery({
    accessToken,
    children
}: {
    accessToken: string;
    children: React.ReactNode;
}) {
    // Several cards can fail at once (the whole board shares one
    // session), so collapse concurrent attempts onto one in-flight
    // request instead of hammering the endpoint with identical sign-ins.
    const inFlight = useRef<Promise<boolean> | null>(null);

    const recover = useCallback<Recover>(() => {
        if (inFlight.current) return inFlight.current;
        const attempt = (async () => {
            try {
                const res = await fetch('/api/station/reauth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: accessToken })
                });
                return res.ok;
            } catch {
                // Offline / network blip — the caller reports it as a
                // failed reconnect rather than a bogus auth error.
                return false;
            } finally {
                inFlight.current = null;
            }
        })();
        inFlight.current = attempt;
        return attempt;
    }, [accessToken]);

    return (
        <SessionRecoveryContext.Provider value={recover}>
            {children}
        </SessionRecoveryContext.Provider>
    );
}

/** Null outside a provider — callers must treat recovery as unavailable. */
export function useSessionRecovery(): Recover | null {
    return useContext(SessionRecoveryContext);
}
