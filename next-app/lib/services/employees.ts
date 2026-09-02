import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Employee profiles (HR module) ──────────────────────────────────
// A 4th user population. Each row's PK is the auth.users id. Admin
// creates them (service role) and invites by email; the employee sets
// their own password via a single-use activation token. Mirrors the
// station-users service shape.

export interface Employee {
    id: string;
    fullName: string;
    email: string;
    position: string;
    phone: string;
    isActive: boolean;
    /** Set once the employee has chosen their password via the invite. */
    activatedAt: string | null;
    passwordSetAt: string | null;
    /** Non-null while an invite is outstanding. */
    activationExpiresAt: string | null;
    createdAt: string;
}

interface RawRow {
    id: string;
    full_name: string;
    email: string;
    position: string | null;
    phone: string | null;
    is_active: boolean;
    activation_expires_at: string | null;
    activated_at: string | null;
    password_set_at: string | null;
    created_at: string;
}

// Note: activation_token is deliberately NOT in the list select — it's a
// secret only handled server-side by the token lookup below.
const SELECT =
    'id, full_name, email, position, phone, is_active, activation_expires_at, activated_at, password_set_at, created_at';

const mapRow = (r: RawRow): Employee => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    position: r.position || '',
    phone: r.phone || '',
    isActive: r.is_active,
    activatedAt: r.activated_at,
    passwordSetAt: r.password_set_at,
    activationExpiresAt: r.activation_expires_at,
    createdAt: r.created_at
});

export async function fetchEmployees(
    supabase: SupabaseClient
): Promise<Employee[]> {
    const { data, error } = await supabase
        .from('employees')
        .select(SELECT)
        .order('full_name', { ascending: true });
    if (error) throw error;
    return ((data || []) as RawRow[]).map(mapRow);
}

/** Look up an employee by their auth user id. Returns null for
 *  admin/company/station users — RLS self-read only exposes own row, so
 *  this is what the layouts use to keep the populations disjoint. */
export async function fetchEmployee(
    supabase: SupabaseClient,
    userId: string
): Promise<Employee | null> {
    const { data, error } = await supabase
        .from('employees')
        .select(SELECT)
        .eq('id', userId)
        .maybeSingle();
    if (error) {
        // Runs in the (app) layout for every non-admin user. If migration
        // 0035 hasn't been applied yet the table is missing (42P01) — treat
        // that as "not an employee" so the customer shell keeps working
        // instead of hard-failing. Any other error is a real problem.
        if ((error as { code?: string }).code === '42P01') return null;
        throw error;
    }
    return data ? mapRow(data as RawRow) : null;
}

export interface EmployeeTokenInfo {
    id: string;
    fullName: string;
    email: string;
    activationExpiresAt: string | null;
    /** True when the invite has passed its expiry. Computed here (a plain
     *  module) so callers — including server components — don't read the
     *  clock during render. */
    expired: boolean;
}

/** Validate an invite/set-password token. Service-role only (the token
 *  column isn't exposed via RLS). Returns null if no row matches. */
export async function fetchEmployeeByActivationToken(
    serviceSupabase: SupabaseClient,
    token: string
): Promise<EmployeeTokenInfo | null> {
    const { data, error } = await serviceSupabase
        .from('employees')
        .select('id, full_name, email, activation_expires_at')
        .eq('activation_token', token)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as {
        id: string;
        full_name: string;
        email: string;
        activation_expires_at: string | null;
    };
    return {
        id: r.id,
        fullName: r.full_name,
        email: r.email,
        activationExpiresAt: r.activation_expires_at,
        expired: r.activation_expires_at
            ? new Date(r.activation_expires_at).getTime() < Date.now()
            : false
    };
}

/**
 * Insert the employees row. The auth.users row must already exist
 * (created via supabase.auth.admin.createUser by the calling action).
 */
export async function createEmployeeRow(
    serviceSupabase: SupabaseClient,
    input: {
        id: string;
        fullName: string;
        email: string;
        position: string;
        phone: string;
        activationToken: string;
        activationExpiresAt: string;
        createdBy: string | null;
    }
): Promise<Employee> {
    const { data, error } = await serviceSupabase
        .from('employees')
        .insert({
            id: input.id,
            full_name: input.fullName,
            email: input.email,
            position: input.position || null,
            phone: input.phone || null,
            activation_token: input.activationToken,
            activation_expires_at: input.activationExpiresAt,
            created_by: input.createdBy
        })
        .select(SELECT)
        .single();
    if (error) throw error;
    return mapRow(data as RawRow);
}

/** Reissue an invite: store a fresh token + expiry. */
export async function setEmployeeActivation(
    serviceSupabase: SupabaseClient,
    userId: string,
    token: string,
    expiresAt: string
): Promise<void> {
    const { error } = await serviceSupabase
        .from('employees')
        .update({ activation_token: token, activation_expires_at: expiresAt })
        .eq('id', userId);
    if (error) throw error;
}

/** Mark the account activated and burn the single-use token. */
export async function markEmployeeActivated(
    serviceSupabase: SupabaseClient,
    userId: string
): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await serviceSupabase
        .from('employees')
        .update({
            activated_at: now,
            password_set_at: now,
            activation_token: null,
            activation_expires_at: null
        })
        .eq('id', userId);
    if (error) throw error;
}

export async function setEmployeeActive(
    serviceSupabase: SupabaseClient,
    userId: string,
    isActive: boolean
): Promise<void> {
    const { error } = await serviceSupabase
        .from('employees')
        .update({ is_active: isActive })
        .eq('id', userId);
    if (error) throw error;
}

export async function updateEmployeeRow(
    serviceSupabase: SupabaseClient,
    userId: string,
    input: { fullName: string; position: string; phone: string }
): Promise<void> {
    const { error } = await serviceSupabase
        .from('employees')
        .update({
            full_name: input.fullName,
            position: input.position || null,
            phone: input.phone || null
        })
        .eq('id', userId);
    if (error) throw error;
}
