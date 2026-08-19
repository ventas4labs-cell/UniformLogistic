import type { SupabaseClient } from '@supabase/supabase-js';

export interface Company {
    id: string;
    name: string;
    documentNumber: string;
    contactName: string;
    email: string;
    phone: string;
    address: string;
    isActive: boolean;
    createdAt: string;
    /** Order-link token (the /o/<token> slug). Empty until provisioned. */
    accessToken: string;
    /** auth.users id the order link signs in as. */
    orderUserId: string;
    /** That user's (synthetic) email, used for the server-side sign-in. */
    orderUserEmail: string;
    /** Master switch for the 3D custom-order feature for this empresa. */
    customOrderEnabled: boolean;
}

export interface CompanyInput {
    name: string;
    documentNumber: string;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    isActive?: boolean;
}

interface CompanyRow {
    id: string;
    name: string;
    document_number: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    is_active: boolean | null;
    created_at: string;
    access_token: string | null;
    order_user_id: string | null;
    order_user_email: string | null;
    custom_order_enabled: boolean | null;
}

const mapRow = (row: CompanyRow): Company => ({
    id: row.id,
    name: row.name,
    documentNumber: row.document_number,
    contactName: row.contact_name || '',
    email: row.email || '',
    phone: row.phone || '',
    address: row.address || '',
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    accessToken: row.access_token || '',
    orderUserId: row.order_user_id || '',
    orderUserEmail: row.order_user_email || '',
    customOrderEnabled: row.custom_order_enabled !== false
});

const SELECT =
    'id, name, document_number, contact_name, email, phone, address, is_active, created_at, access_token, order_user_id, order_user_email, custom_order_enabled';

export const fetchCompanies = async (
    supabase: SupabaseClient
): Promise<Company[]> => {
    const { data, error } = await supabase
        .from('companies')
        .select(SELECT)
        .order('name', { ascending: true });
    if (error) throw error;
    return (data as CompanyRow[]).map(mapRow);
};

export const fetchCompanyById = async (
    supabase: SupabaseClient,
    id: string
): Promise<Company | null> => {
    const { data, error } = await supabase
        .from('companies')
        .select(SELECT)
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data as CompanyRow) : null;
};

export const createCompany = async (
    supabase: SupabaseClient,
    input: CompanyInput
): Promise<Company> => {
    const { data, error } = await supabase
        .from('companies')
        .insert({
            name: input.name,
            document_number: input.documentNumber,
            contact_name: input.contactName || null,
            email: input.email || null,
            phone: input.phone || null,
            address: input.address || null,
            is_active: input.isActive ?? true
        })
        .select(SELECT)
        .single();
    if (error) throw error;
    return mapRow(data as CompanyRow);
};

export const updateCompany = async (
    supabase: SupabaseClient,
    id: string,
    input: CompanyInput
): Promise<Company> => {
    const { data, error } = await supabase
        .from('companies')
        .update({
            name: input.name,
            document_number: input.documentNumber,
            contact_name: input.contactName || null,
            email: input.email || null,
            phone: input.phone || null,
            address: input.address || null,
            is_active: input.isActive ?? true
        })
        .eq('id', id)
        .select(SELECT)
        .single();
    if (error) throw error;
    return mapRow(data as CompanyRow);
};

export const deleteCompany = async (
    supabase: SupabaseClient,
    id: string
): Promise<void> => {
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (error) throw error;
};

/** Flip the 3D custom-order feature on/off for one empresa. */
export const setCompanyCustomOrderEnabled = async (
    supabase: SupabaseClient,
    id: string,
    enabled: boolean
): Promise<void> => {
    const { error } = await supabase
        .from('companies')
        .update({ custom_order_enabled: enabled })
        .eq('id', id);
    if (error) throw error;
};

/** Cheap gate read: is the 3D custom-order feature enabled for a company?
 *  Missing row or null column both resolve to enabled (feature-on default). */
export const isCustomOrderEnabled = async (
    supabase: SupabaseClient,
    companyId: string
): Promise<boolean> => {
    const { data, error } = await supabase
        .from('companies')
        .select('custom_order_enabled')
        .eq('id', companyId)
        .maybeSingle();
    if (error) throw error;
    return (data?.custom_order_enabled ?? true) !== false;
};

// ─── Order-link helpers ──────────────────────────────────────────────

/** Resolve a company from its order-link token. Service-role read used
 *  by the /o/[token] route to validate before signing the order user in. */
export const fetchCompanyByAccessToken = async (
    serviceSupabase: SupabaseClient,
    token: string
): Promise<Company | null> => {
    const { data, error } = await serviceSupabase
        .from('companies')
        .select(SELECT)
        .eq('access_token', token)
        .eq('is_active', true)
        .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data as CompanyRow) : null;
};

// ─── Company login / activation ─────────────────────────────────────

export interface CompanyActivation {
    id: string;
    name: string;
    /** Real contact email on file, if any (may be null for older rows). */
    email: string | null;
    /** Email the company typed at first login, awaiting confirmation. */
    pendingEmail: string | null;
    orderUserId: string;
    passwordSetAt: string | null;
    activatedAt: string | null;
}

/** Non-secret welcome + activation state for the login page (looked up
 *  by the company id the /o link redirect carries). */
export const fetchCompanyActivation = async (
    serviceSupabase: SupabaseClient,
    companyId: string
): Promise<CompanyActivation | null> => {
    const { data, error } = await serviceSupabase
        .from('companies')
        .select(
            'id, name, email, pending_email, order_user_id, password_set_at, activated_at, is_active'
        )
        .eq('id', companyId)
        .eq('is_active', true)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as {
        id: string;
        name: string;
        email: string | null;
        pending_email: string | null;
        order_user_id: string | null;
        password_set_at: string | null;
        activated_at: string | null;
    };
    return {
        id: r.id,
        name: r.name,
        email: r.email,
        pendingEmail: r.pending_email,
        orderUserId: r.order_user_id || '',
        passwordSetAt: r.password_set_at,
        activatedAt: r.activated_at
    };
};

export interface CompanyByActivationToken {
    id: string;
    name: string;
    accessToken: string;
    orderUserId: string;
    pendingEmail: string | null;
    activationExpiresAt: string | null;
    activatedAt: string | null;
}

/** Resolve a company from a /activar/<token> confirmation token. */
export const fetchCompanyByActivationToken = async (
    serviceSupabase: SupabaseClient,
    token: string
): Promise<CompanyByActivationToken | null> => {
    const { data, error } = await serviceSupabase
        .from('companies')
        .select(
            'id, name, access_token, order_user_id, pending_email, activation_expires_at, activated_at'
        )
        .eq('activation_token', token)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as {
        id: string;
        name: string;
        access_token: string | null;
        order_user_id: string | null;
        pending_email: string | null;
        activation_expires_at: string | null;
        activated_at: string | null;
    };
    return {
        id: r.id,
        name: r.name,
        accessToken: r.access_token || '',
        orderUserId: r.order_user_id || '',
        pendingEmail: r.pending_email,
        activationExpiresAt: r.activation_expires_at,
        activatedAt: r.activated_at
    };
};

/** Find an activated company by its confirmed login email (for reset). */
export const fetchActivatedCompanyByEmail = async (
    serviceSupabase: SupabaseClient,
    email: string
): Promise<{ id: string; name: string; orderUserId: string } | null> => {
    const { data, error } = await serviceSupabase
        .from('companies')
        .select('id, name, order_user_id')
        .ilike('email', email)
        .not('activated_at', 'is', null)
        .eq('is_active', true)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as { id: string; name: string; order_user_id: string | null };
    return { id: r.id, name: r.name, orderUserId: r.order_user_id || '' };
};

/** Resolve a company from a /restablecer/<token> reset token. */
export const fetchCompanyByResetToken = async (
    serviceSupabase: SupabaseClient,
    token: string
): Promise<{
    id: string;
    name: string;
    orderUserId: string;
    resetExpiresAt: string | null;
} | null> => {
    const { data, error } = await serviceSupabase
        .from('companies')
        .select('id, name, order_user_id, reset_expires_at')
        .eq('reset_token', token)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as {
        id: string;
        name: string;
        order_user_id: string | null;
        reset_expires_at: string | null;
    };
    return {
        id: r.id,
        name: r.name,
        orderUserId: r.order_user_id || '',
        resetExpiresAt: r.reset_expires_at
    };
};

/** Persist the provisioned order-link fields onto the company row. */
export const setCompanyOrderLink = async (
    serviceSupabase: SupabaseClient,
    id: string,
    fields: { accessToken: string; orderUserId: string; orderUserEmail: string }
): Promise<void> => {
    const { error } = await serviceSupabase
        .from('companies')
        .update({
            access_token: fields.accessToken,
            order_user_id: fields.orderUserId,
            order_user_email: fields.orderUserEmail
        })
        .eq('id', id);
    if (error) throw error;
};

/** Rotate only the token (used when re-provisioning an existing order user). */
export const setCompanyAccessToken = async (
    serviceSupabase: SupabaseClient,
    id: string,
    token: string
): Promise<void> => {
    const { error } = await serviceSupabase
        .from('companies')
        .update({ access_token: token })
        .eq('id', id);
    if (error) throw error;
};
