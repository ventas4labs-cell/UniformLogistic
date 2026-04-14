'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createCompany, updateCompany, deleteCompany, CompanyInput } from '@/lib/services/companies';

export async function createCompanyAction(input: CompanyInput) {
    const supabase = await createClient();
    await createCompany(supabase, input);
    revalidatePath('/admin/companies');
}

export async function updateCompanyAction(id: string, input: CompanyInput) {
    const supabase = await createClient();
    await updateCompany(supabase, id, input);
    revalidatePath('/admin/companies');
}

export async function deleteCompanyAction(id: string) {
    const supabase = await createClient();
    await deleteCompany(supabase, id);
    revalidatePath('/admin/companies');
}
