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

export async function signInWithGoogleAction(): Promise<AuthState> {
    const supabase = await createClient();
    // Build a redirect URL that lands the user back on /home after the OAuth round-trip.
    // The Supabase project's Auth → URL Configuration must allow this URL.
    const origin =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.VERCEL_URL ||
        'http://localhost:3001';
    const redirectTo = origin.startsWith('http')
        ? `${origin}/auth/callback`
        : `https://${origin}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
    });
    if (error) return { error: error.message };
    if (data?.url) redirect(data.url);
    return { error: 'No se pudo iniciar el flujo de Google.' };
}
