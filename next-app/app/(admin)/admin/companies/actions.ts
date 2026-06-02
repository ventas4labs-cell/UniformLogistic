'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    createCompany,
    updateCompany,
    deleteCompany,
    CompanyInput
} from '@/lib/services/companies';
import {
    createUser as createCustomerUser,
    assignUserToCompany
} from '@/lib/services/companyUsers';
import { isAdminEmail } from '@/lib/admin-acting-company';

export interface InitialUserInput {
    email: string;
    password: string;
    fullName?: string;
}

/**
 * Creates the empresa, and (optionally) a customer user account
 * linked to it in the same atomic-ish flow:
 *
 *   1. Insert the company.
 *   2. If initialUser is provided, call the admin_create_user RPC.
 *   3. Insert the company_users link.
 *
 * Step 2 or 3 failures roll back step 1 so admin doesn't end up
 * with an orphan empresa. A successful run revalidates both
 * /admin/companies and /admin/users.
 */
export async function createCompanyAction(
    input: CompanyInput,
    initialUser?: InitialUserInput
): Promise<{ error?: string; companyId?: string; userId?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado.' };
    if (!isAdminEmail(user.email)) return { error: 'No autorizado.' };

    let company;
    try {
        company = await createCompany(supabase, input);
    } catch (err) {
        return {
            error: `No se pudo crear la empresa: ${err instanceof Error ? err.message : 'error desconocido'}`
        };
    }

    // No initial user requested → done.
    if (!initialUser || !initialUser.email.trim() || !initialUser.password.trim()) {
        revalidatePath('/admin/companies');
        return { companyId: company.id };
    }

    if (initialUser.password.length < 8) {
        await deleteCompany(supabase, company.id);
        return { error: 'La contraseña debe tener al menos 8 caracteres.' };
    }

    let userId: string;
    try {
        userId = await createCustomerUser(
            supabase,
            initialUser.email.trim().toLowerCase(),
            initialUser.password,
            (initialUser.fullName || input.contactName || '').trim()
        );
    } catch (err) {
        await deleteCompany(supabase, company.id);
        return {
            error: `No se pudo crear el usuario: ${err instanceof Error ? err.message : 'error desconocido'}`
        };
    }

    try {
        await assignUserToCompany(supabase, userId, company.id);
    } catch (err) {
        // Link failed; leave the user and company in place so admin
        // can re-link from /admin/users.
        revalidatePath('/admin/companies');
        revalidatePath('/admin/users');
        return {
            error: `Empresa y usuario creados, pero no se pudo asignar: ${err instanceof Error ? err.message : 'error desconocido'}`,
            companyId: company.id,
            userId
        };
    }

    revalidatePath('/admin/companies');
    revalidatePath('/admin/users');
    return { companyId: company.id, userId };
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
