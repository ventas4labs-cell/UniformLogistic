'use server';

import { randomBytes } from 'node:crypto';
import { createServiceClient } from '@/utils/supabase/server';
import {
    fetchKioskByAccessToken,
    fetchCurrentToken,
    insertToken
} from '@/lib/services/hr-kiosks';

// A fresh code appears every 2 minutes. Because every punch now needs
// its own scan, the code has to turn over quickly — otherwise someone who
// just punched has to stand around waiting for the next one.
const ROTATE_MS = 2 * 60 * 1000;
// A code stays punchable for a minute after it stops being displayed, so
// scanning a second before the rotation doesn't fail with "código venció"
// by the time the employee taps the button. It's still single-use per
// employee, so the grace period doesn't grant an extra punch.
const GRACE_MS = 60 * 1000;

/**
 * Return the kiosk's current punch token, minting a fresh one when the
 * last has expired. Public (the kiosk screen has no session) but gated
 * by the secret kiosk access token in the URL.
 */
export async function getCurrentKioskTokenAction(
    kioskAccessToken: string
): Promise<{ error?: string; token?: string; rotatesAt?: string }> {
    if (!kioskAccessToken) return { error: 'Kiosco inválido.' };
    const service = createServiceClient();
    const kiosk = await fetchKioskByAccessToken(service, kioskAccessToken);
    if (!kiosk) return { error: 'Kiosco inválido o inactivo.' };

    const rotatesAt = (createdAt: string) =>
        new Date(new Date(createdAt).getTime() + ROTATE_MS).toISOString();

    const current = await fetchCurrentToken(service, kiosk.id, ROTATE_MS);
    if (current) {
        return { token: current.token, rotatesAt: rotatesAt(current.createdAt) };
    }

    const token = randomBytes(18).toString('base64url');
    const expiresAt = new Date(Date.now() + ROTATE_MS + GRACE_MS).toISOString();
    const issued = await insertToken(service, kiosk.id, token, expiresAt);
    return { token: issued.token, rotatesAt: rotatesAt(issued.createdAt) };
}
