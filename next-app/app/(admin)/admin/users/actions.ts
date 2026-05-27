'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import {
    assignUserToCompany,
    unassignUser,
    createUser,
    updateUser,
    setUserPassword,
    deleteUserAccount
} from '@/lib/services/companyUsers';
import { isAdminEmail } from '@/lib/admin-acting-company';

export async function assignUserAction(userId: string, companyId: string) {
    const supabase = await createClient();
    if (companyId === '') {
        await unassignUser(supabase, userId);
    } else {
        await assignUserToCompany(supabase, userId, companyId);
    }
    revalidatePath('/admin/users');
}

export async function createUserAction(email: string, password: string, fullName: string) {
    const supabase = await createClient();
    await createUser(supabase, email, password, fullName);
    revalidatePath('/admin/users');
}

export async function updateUserAction(
    userId: string,
    email: string,
    fullName: string,
    phone: string
) {
    const supabase = await createClient();
    await updateUser(supabase, userId, email, fullName, phone);
    revalidatePath('/admin/users');
}

export async function setUserPasswordAction(userId: string, password: string) {
    const supabase = await createClient();
    await setUserPassword(supabase, userId, password);
}

export async function deleteUserAction(
    userId: string
): Promise<{ error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado' };
    if (!isAdminEmail(user.email)) return { error: 'No autorizado' };
    // Block deleting the currently-signed-in admin to avoid locking
    // the only admin out of the platform.
    if (user.id === userId) {
        return { error: 'No podés eliminar tu propia cuenta de admin.' };
    }
    try {
        const service = createServiceClient();
        await deleteUserAccount(service, userId);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        return { error: `No se pudo eliminar: ${msg}` };
    }
    revalidatePath('/admin/users');
    revalidatePath('/admin/station-users');
    revalidatePath('/admin/orders');
    return {};
}
