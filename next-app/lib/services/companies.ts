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
    orderUserEmail: row.order_user_email || ''
});

const SELECT =
    'id, name, document_number, contact_name, email, phone, address, is_active, created_at, access_token, order_user_id, order_user_email';

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
