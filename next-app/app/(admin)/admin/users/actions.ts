'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    assignUserToCompany,
    unassignUser,
    createUser,
    updateUser,
    setUserPassword
} from '@/lib/services/companyUsers';

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
