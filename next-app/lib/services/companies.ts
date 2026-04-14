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
    createdAt: row.created_at
});

const SELECT =
    'id, name, document_number, contact_name, email, phone, address, is_active, created_at';

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
