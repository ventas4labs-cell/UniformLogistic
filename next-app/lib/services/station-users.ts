import type { SupabaseClient } from '@supabase/supabase-js';
import type { StageKey } from './stage-completions';

// ─── External station-user accounts ──────────────────────────────────
// Created by admin (via service role) for outside contractors who
// only see the orders they've been assigned to. Each user is bound to
// a single stage; the station shell restricts the UI accordingly.

export interface StationUser {
    id: string;
    email: string;
    displayName: string;
    stage: StageKey;
    isActive: boolean;
    createdAt: string;
    // Stable random slug shared with the station: `/s/<accessToken>`
    // signs them in and lands them on /station. Doubles as the auth
    // password (rotating one rotates the other).
    accessToken: string;
}

interface RawRow {
    id: string;
    email: string;
    display_name: string;
    stage: string;
    is_active: boolean;
    created_at: string;
    access_token: string;
}

const SELECT =
    'id, email, display_name, stage, is_active, created_at, access_token';

const mapRow = (r: RawRow): StationUser => ({
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    stage: r.stage as StageKey,
    isActive: r.is_active,
    createdAt: r.created_at,
    accessToken: r.access_token
});

export async function fetchStationUsers(
    supabase: SupabaseClient
): Promise<StationUser[]> {
    const { data, error } = await supabase
        .from('station_users')
        .select(SELECT)
        .order('display_name', { ascending: true });
    if (error) throw error;
    return ((data || []) as RawRow[]).map(mapRow);
}

export async function fetchStationUser(
    supabase: SupabaseClient,
    userId: string
): Promise<StationUser | null> {
    const { data, error } = await supabase
        .from('station_users')
        .select(SELECT)
        .eq('id', userId)
        .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data as RawRow) : null;
}

/** Look up by the URL-slug token. Returns null if no active station
 *  matches — the /s/[token] route uses this to validate before
 *  signing the station in. */
export async function fetchStationUserByAccessToken(
    serviceSupabase: SupabaseClient,
    token: string
): Promise<StationUser | null> {
    const { data, error } = await serviceSupabase
        .from('station_users')
        .select(SELECT)
        .eq('access_token', token)
        .eq('is_active', true)
        .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data as RawRow) : null;
}

/**
 * Insert the station_users row. The auth.users row must already exist
 * (created via supabase.auth.admin.createUser by the calling action).
 */
export async function createStationUserRow(
    serviceSupabase: SupabaseClient,
    input: {
        id: string;
        email: string;
        displayName: string;
        stage: StageKey;
        accessToken: string;
        createdBy: string | null;
    }
): Promise<StationUser> {
    const { data, error } = await serviceSupabase
        .from('station_users')
        .insert({
            id: input.id,
            email: input.email,
            display_name: input.displayName,
            stage: input.stage,
            access_token: input.accessToken,
            created_by: input.createdBy
        })
        .select(SELECT)
        .single();
    if (error) throw error;
    return mapRow(data as RawRow);
}

export async function setStationAccessToken(
    serviceSupabase: SupabaseClient,
    userId: string,
    token: string
): Promise<void> {
    const { error } = await serviceSupabase
        .from('station_users')
        .update({ access_token: token })
        .eq('id', userId);
    if (error) throw error;
}

export async function setStationUserActive(
    serviceSupabase: SupabaseClient,
    userId: string,
    isActive: boolean
): Promise<void> {
    const { error } = await serviceSupabase
        .from('station_users')
        .update({ is_active: isActive })
        .eq('id', userId);
    if (error) throw error;
}
