import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Kiosks + rotating punch tokens ─────────────────────────────────
// A kiosk is a shared screen at the workplace, reached via a secret
// /rrhh/kiosko/<access_token> link. It shows a QR of the current punch
// token, which rotates every ~10 min.

export interface Kiosk {
    id: string;
    label: string;
    accessToken: string;
    isActive: boolean;
    createdAt: string;
}

interface KioskRow {
    id: string;
    label: string;
    access_token: string;
    is_active: boolean;
    created_at: string;
}

const KIOSK_SELECT = 'id, label, access_token, is_active, created_at';

const mapKiosk = (r: KioskRow): Kiosk => ({
    id: r.id,
    label: r.label,
    accessToken: r.access_token,
    isActive: r.is_active,
    createdAt: r.created_at
});

export async function fetchKiosks(supabase: SupabaseClient): Promise<Kiosk[]> {
    const { data, error } = await supabase
        .from('hr_kiosks')
        .select(KIOSK_SELECT)
        .order('created_at', { ascending: true });
    if (error) {
        if ((error as { code?: string }).code === '42P01') return [];
        throw error;
    }
    return ((data || []) as KioskRow[]).map(mapKiosk);
}

/** Look up an active kiosk by its URL slug. Service-role — the kiosk
 *  page is public (no session), so it can't rely on RLS. */
export async function fetchKioskByAccessToken(
    serviceSupabase: SupabaseClient,
    token: string
): Promise<Kiosk | null> {
    const { data, error } = await serviceSupabase
        .from('hr_kiosks')
        .select(KIOSK_SELECT)
        .eq('access_token', token)
        .eq('is_active', true)
        .maybeSingle();
    if (error) throw error;
    return data ? mapKiosk(data as KioskRow) : null;
}

export async function createKioskRow(
    serviceSupabase: SupabaseClient,
    input: { label: string; accessToken: string; createdBy: string | null }
): Promise<Kiosk> {
    const { data, error } = await serviceSupabase
        .from('hr_kiosks')
        .insert({
            label: input.label,
            access_token: input.accessToken,
            created_by: input.createdBy
        })
        .select(KIOSK_SELECT)
        .single();
    if (error) throw error;
    return mapKiosk(data as KioskRow);
}

export async function setKioskAccessToken(
    serviceSupabase: SupabaseClient,
    id: string,
    token: string
): Promise<void> {
    const { error } = await serviceSupabase
        .from('hr_kiosks')
        .update({ access_token: token })
        .eq('id', id);
    if (error) throw error;
}

export async function setKioskActive(
    serviceSupabase: SupabaseClient,
    id: string,
    isActive: boolean
): Promise<void> {
    const { error } = await serviceSupabase
        .from('hr_kiosks')
        .update({ is_active: isActive })
        .eq('id', id);
    if (error) throw error;
}

export async function deleteKioskRow(
    serviceSupabase: SupabaseClient,
    id: string
): Promise<void> {
    const { error } = await serviceSupabase.from('hr_kiosks').delete().eq('id', id);
    if (error) throw error;
}

// ─── Rotating tokens ────────────────────────────────────────────────

export interface CurrentToken {
    token: string;
    expiresAt: string;
}

/** The latest still-valid token for a kiosk, or null if none/expired. */
export async function fetchCurrentToken(
    serviceSupabase: SupabaseClient,
    kioskId: string
): Promise<CurrentToken | null> {
    const { data, error } = await serviceSupabase
        .from('hr_qr_tokens')
        .select('token, expires_at')
        .eq('kiosk_id', kioskId)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as { token: string; expires_at: string };
    return { token: r.token, expiresAt: r.expires_at };
}

export async function insertToken(
    serviceSupabase: SupabaseClient,
    kioskId: string,
    token: string,
    expiresAt: string
): Promise<CurrentToken> {
    const { error } = await serviceSupabase.from('hr_qr_tokens').insert({
        kiosk_id: kioskId,
        token,
        expires_at: expiresAt
    });
    if (error) throw error;
    return { token, expiresAt };
}

/** Validate a punch token: returns its id + expiry (+ whether it's
 *  expired, computed here so server components don't read the clock),
 *  or null if the token is unknown. */
export async function fetchPunchToken(
    serviceSupabase: SupabaseClient,
    token: string
): Promise<{ id: string; expiresAt: string; expired: boolean } | null> {
    const { data, error } = await serviceSupabase
        .from('hr_qr_tokens')
        .select('id, expires_at')
        .eq('token', token)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as { id: string; expires_at: string };
    return {
        id: r.id,
        expiresAt: r.expires_at,
        expired: new Date(r.expires_at).getTime() < Date.now()
    };
}

// ─── One punch per scan ─────────────────────────────────────────────
// A displayed token is shared by everyone at the screen, so it can be
// spent once PER EMPLOYEE. The composite PK on hr_qr_token_uses makes
// the claim atomic — a duplicate insert means "already used".

/** Try to spend this token for this employee. False = already used. */
export async function claimPunchToken(
    serviceSupabase: SupabaseClient,
    tokenId: string,
    employeeId: string
): Promise<boolean> {
    const { error } = await serviceSupabase
        .from('hr_qr_token_uses')
        .insert({ token_id: tokenId, employee_id: employeeId });
    if (!error) return true;
    // 23505 = unique_violation → this employee already used this code.
    if ((error as { code?: string }).code === '23505') return false;
    throw error;
}

/** Release a claim (used when the punch insert itself fails). */
export async function releasePunchToken(
    serviceSupabase: SupabaseClient,
    tokenId: string,
    employeeId: string
): Promise<void> {
    await serviceSupabase
        .from('hr_qr_token_uses')
        .delete()
        .eq('token_id', tokenId)
        .eq('employee_id', employeeId);
}

/** Has this employee already spent this token? Drives the page state. */
export async function hasUsedPunchToken(
    serviceSupabase: SupabaseClient,
    tokenId: string,
    employeeId: string
): Promise<boolean> {
    const { data, error } = await serviceSupabase
        .from('hr_qr_token_uses')
        .select('token_id')
        .eq('token_id', tokenId)
        .eq('employee_id', employeeId)
        .maybeSingle();
    if (error) {
        if ((error as { code?: string }).code === '42P01') return false;
        throw error;
    }
    return !!data;
}
