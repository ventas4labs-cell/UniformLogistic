'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export interface AuthState {
    error?: string;
    message?: string;
}

export async function signInAction(
    _prev: AuthState | undefined,
    formData: FormData
): Promise<AuthState> {
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    revalidatePath('/', 'layout');
    redirect('/home');
}

export async function signUpAction(
    _prev: AuthState | undefined,
    formData: FormData
): Promise<AuthState> {
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');
    const fullName = String(formData.get('full_name') || '').trim();
    const companyName = String(formData.get('company_name') || '').trim();
    const phone = String(formData.get('phone') || '').trim();

    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: fullName, company_name: companyName, phone },
        },
    });
    if (error) return { error: error.message };

    return { message: '¡Cuenta creada! Por favor revisa tu correo para verificación.' };
}

export async function signOutAction() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    revalidatePath('/', 'layout');
    redirect('/login');
}
