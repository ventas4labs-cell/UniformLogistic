'use server';

import { randomBytes } from 'node:crypto';
import { createServiceClient } from '@/utils/supabase/server';
import {
    fetchKioskByAccessToken,
    fetchCurrentToken,
    insertToken
} from '@/lib/services/hr-kiosks';

// Rotate the punch token every 10 minutes.
const QR_TTL_MS = 10 * 60 * 1000;

/**
 * Return the kiosk's current punch token, minting a fresh one when the
 * last has expired. Public (the kiosk screen has no session) but gated
 * by the secret kiosk access token in the URL.
 */
export async function getCurrentKioskTokenAction(
    kioskAccessToken: string
): Promise<{ error?: string; token?: string; expiresAt?: string }> {
    if (!kioskAccessToken) return { error: 'Kiosco inválido.' };
    const service = createServiceClient();
    const kiosk = await fetchKioskByAccessToken(service, kioskAccessToken);
    if (!kiosk) return { error: 'Kiosco inválido o inactivo.' };

    const current = await fetchCurrentToken(service, kiosk.id);
    if (current) return { token: current.token, expiresAt: current.expiresAt };

    const token = randomBytes(18).toString('base64url');
    const expiresAt = new Date(Date.now() + QR_TTL_MS).toISOString();
    const issued = await insertToken(service, kiosk.id, token, expiresAt);
    return { token: issued.token, expiresAt: issued.expiresAt };
}
