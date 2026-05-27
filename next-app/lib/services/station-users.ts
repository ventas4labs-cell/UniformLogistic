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
}

interface RawRow {
    id: string;
    email: string;
    display_name: string;
    stage: string;
    is_active: boolean;
    created_at: string;
}

const mapRow = (r: RawRow): StationUser => ({
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    stage: r.stage as StageKey,
    isActive: r.is_active,
    createdAt: r.created_at
});

export async function fetchStationUsers(
    supabase: SupabaseClient
): Promise<StationUser[]> {
    const { data, error } = await supabase
        .from('station_users')
        .select('id, email, display_name, stage, is_active, created_at')
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
        .select('id, email, display_name, stage, is_active, created_at')
        .eq('id', userId)
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
            created_by: input.createdBy
        })
        .select('id, email, display_name, stage, is_active, created_at')
        .single();
    if (error) throw error;
    return mapRow(data as RawRow);
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
