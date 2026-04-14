import type { SupabaseClient } from '@supabase/supabase-js';

export interface DirectoryUser {
    userId: string;
    email: string;
    fullName: string;
    phone: string;
    companyId: string | null;
    companyName: string | null;
    role: string | null;
    signedUpAt: string;
}

interface DirectoryRow {
    user_id: string;
    email: string;
    full_name: string;
    phone: string;
    company_id: string | null;
    company_name: string | null;
    role: string | null;
    signed_up_at: string;
}

const mapRow = (row: DirectoryRow): DirectoryUser => ({
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name || '',
    phone: row.phone || '',
    companyId: row.company_id,
    companyName: row.company_name,
    role: row.role,
    signedUpAt: row.signed_up_at
});

export const fetchUserDirectory = async (
    supabase: SupabaseClient
): Promise<DirectoryUser[]> => {
    const { data, error } = await supabase.rpc('admin_list_users');
    if (error) throw error;
    return ((data || []) as DirectoryRow[]).map(mapRow);
};

export const assignUserToCompany = async (
    supabase: SupabaseClient,
    userId: string,
    companyId: string,
    role: string = 'client'
): Promise<void> => {
    const { error } = await supabase
        .from('company_users')
        .upsert(
            { user_id: userId, company_id: companyId, role },
            { onConflict: 'user_id' }
        );
    if (error) throw error;
};

export const unassignUser = async (
    supabase: SupabaseClient,
    userId: string
): Promise<void> => {
    const { error } = await supabase
        .from('company_users')
        .delete()
        .eq('user_id', userId);
    if (error) throw error;
};

export const createUser = async (
    supabase: SupabaseClient,
    email: string,
    password: string,
    fullName: string = ''
): Promise<string> => {
    const { data, error } = await supabase.rpc('admin_create_user', {
        p_email: email,
        p_password: password,
        p_full_name: fullName
    });
    if (error) throw error;
    return data as string;
};

export const updateUser = async (
    supabase: SupabaseClient,
    userId: string,
    email: string,
    fullName: string,
    phone: string
): Promise<void> => {
    const { error } = await supabase.rpc('admin_update_user', {
        p_user_id: userId,
        p_email: email,
        p_full_name: fullName,
        p_phone: phone
    });
    if (error) throw error;
};

export const setUserPassword = async (
    supabase: SupabaseClient,
    userId: string,
    password: string
): Promise<void> => {
    const { error } = await supabase.rpc('admin_set_password', {
        p_user_id: userId,
        p_password: password
    });
    if (error) throw error;
};
