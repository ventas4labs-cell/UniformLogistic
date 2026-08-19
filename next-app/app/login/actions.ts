'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { landingPath } from '@/lib/admin-acting-company';
import {
    fetchCompanyByAccessToken,
    fetchCompanyActivation,
    fetchActivatedCompanyByEmail,
    fetchCompanyByResetToken
} from '@/lib/services/companies';
import {
    sendCompanyActivationEmail,
    sendPasswordResetEmail
} from '@/lib/email/notifications';

export interface AuthState {
    error?: string;
    message?: string;
}

// Cookie the /o/<token> link drops so the activation flow can identify
// the company without the secret token ever touching the URL.
const COMPANY_LINK_COOKIE = 'ul_company_link';
const ACTIVATION_TTL_HOURS = 48;

const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

/**
 * First-login activation. Gated by possession of the company link
 * (cookie token). Sets the company's chosen password on their auth user
 * and emails a confirmation link — the account isn't usable until that
 * link is clicked (the auth email stays synthetic until then, so their
 * real email can't sign in yet).
 */
export async function activateCompanyAccountAction(
    _prev: AuthState | undefined,
    formData: FormData
): Promise<AuthState> {
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');
    const confirm = String(formData.get('password_confirm') || '');

    if (!isEmail(email)) return { error: 'Ingresá un correo válido.' };
    if (password.length < 8)
        return { error: 'La contraseña debe tener al menos 8 caracteres.' };
    if (password !== confirm) return { error: 'Las contraseñas no coinciden.' };

    const store = await cookies();
    const token = store.get(COMPANY_LINK_COOKIE)?.value;
    if (!token)
        return { error: 'Volvé a abrir el enlace de tu empresa e intentá de nuevo.' };

    const service = createServiceClient();
    const company = await fetchCompanyByAccessToken(service, token);
    if (!company || !company.orderUserId) return { error: 'Enlace inválido.' };

    const state = await fetchCompanyActivation(service, company.id);
    if (state?.activatedAt) {
        return { message: 'Tu cuenta ya está activa. Iniciá sesión con tu correo y contraseña.' };
    }

    // Reject an email already used by another account up front, so they
    // don't get stuck at the confirmation step.
    const { data: available } = await service.rpc('email_available', {
        p_email: email,
        p_user_id: company.orderUserId
    });
    if (available === false) {
        return { error: 'Ese correo ya está registrado con otra cuenta. Usá otro.' };
    }

    // Set the chosen password on the company's auth user via the SQL RPC
    // (the HTTP admin API isn't reachable here). The auth email stays
    // synthetic until they confirm.
    const { error: pwErr } = await service.rpc('admin_set_password', {
        p_user_id: company.orderUserId,
        p_password: password
    });
    if (pwErr) return { error: 'No se pudo guardar la contraseña. Probá de nuevo.' };

    const activationToken = randomBytes(24).toString('base64url');
    const expiresAt = new Date(
        Date.now() + ACTIVATION_TTL_HOURS * 3600 * 1000
    ).toISOString();
    const { error: upErr } = await service
        .from('companies')
        .update({
            pending_email: email,
            password_set_at: new Date().toISOString(),
            activation_token: activationToken,
            activation_expires_at: expiresAt
        })
        .eq('id', company.id);
    if (upErr) return { error: 'No se pudo iniciar la activación. Probá de nuevo.' };

    const h = await headers();
    const origin = `${h.get('x-forwarded-proto') || 'https'}://${h.get('host')}`;
    const sent = await sendCompanyActivationEmail(
        email,
        company.name,
        `${origin}/activar/${activationToken}`,
        `${ACTIVATION_TTL_HOURS} horas`
    );
    if (!sent.ok) {
        return {
            error: 'No se pudo enviar el correo de confirmación. Revisá el correo e intentá de nuevo.'
        };
    }

    return {
        message: `Te enviamos un correo a ${email}. Abrí el enlace para activar tu cuenta.`
    };
}

async function originFromHeaders(): Promise<string> {
    const h = await headers();
    return `${h.get('x-forwarded-proto') || 'https'}://${h.get('host')}`;
}

/**
 * Rollout fallback: a company that hasn't started activating (its token
 * is still its password) can still get in via the old token auto-login.
 * Gated by the link cookie. Removed once everyone has activated.
 */
export async function tokenFallbackLoginAction(
    _prev?: AuthState,
    _formData?: FormData
): Promise<AuthState> {
    void _prev;
    void _formData;
    const store = await cookies();
    const token = store.get(COMPANY_LINK_COOKIE)?.value;
    if (!token) return { error: 'Volvé a abrir el enlace de tu empresa.' };

    const service = createServiceClient();
    const company = await fetchCompanyByAccessToken(service, token);
    if (!company || !company.orderUserEmail) return { error: 'Enlace inválido.' };

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
        email: company.orderUserEmail,
        password: token
    });
    if (error) {
        return { error: 'Este acceso ya no está disponible. Activá tu cuenta con tu correo.' };
    }
    revalidatePath('/', 'layout');
    redirect('/catalog');
}

/** Resend the activation email (reuses the stored pending email + token). */
export async function resendActivationAction(
    _prev?: AuthState,
    _formData?: FormData
): Promise<AuthState> {
    void _prev;
    void _formData;
    const store = await cookies();
    const token = store.get(COMPANY_LINK_COOKIE)?.value;
    if (!token) return { error: 'Volvé a abrir el enlace de tu empresa.' };

    const service = createServiceClient();
    const company = await fetchCompanyByAccessToken(service, token);
    if (!company) return { error: 'Enlace inválido.' };
    const state = await fetchCompanyActivation(service, company.id);
    if (state?.activatedAt) return { message: 'Tu cuenta ya está activa. Iniciá sesión.' };
    if (!state?.pendingEmail) return { error: 'Primero creá tu contraseña.' };

    const activationToken = randomBytes(24).toString('base64url');
    const expiresAt = new Date(
        Date.now() + ACTIVATION_TTL_HOURS * 3600 * 1000
    ).toISOString();
    await service
        .from('companies')
        .update({ activation_token: activationToken, activation_expires_at: expiresAt })
        .eq('id', company.id);

    const origin = await originFromHeaders();
    const sent = await sendCompanyActivationEmail(
        state.pendingEmail,
        company.name,
        `${origin}/activar/${activationToken}`,
        `${ACTIVATION_TTL_HOURS} horas`
    );
    if (!sent.ok) return { error: 'No se pudo reenviar el correo. Probá de nuevo.' };
    return { message: `Reenviamos el correo a ${state.pendingEmail}.` };
}

/**
 * Request a password reset. Always returns a generic success so it never
 * reveals whether an email is registered.
 */
export async function requestPasswordResetAction(
    _prev: AuthState | undefined,
    formData: FormData
): Promise<AuthState> {
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const generic = {
        message: 'Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.'
    };
    if (!isEmail(email)) return { error: 'Ingresá un correo válido.' };

    const service = createServiceClient();
    const company = await fetchActivatedCompanyByEmail(service, email);
    if (!company || !company.orderUserId) return generic;

    const resetToken = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 2 * 3600 * 1000).toISOString(); // 2h
    await service
        .from('companies')
        .update({ reset_token: resetToken, reset_expires_at: expiresAt })
        .eq('id', company.id);

    const origin = await originFromHeaders();
    await sendPasswordResetEmail(
        email,
        company.name,
        `${origin}/restablecer/${resetToken}`,
        '2 horas'
    );
    return generic;
}

/** Complete a password reset from /restablecer/<token>. */
export async function resetPasswordAction(
    _prev: AuthState | undefined,
    formData: FormData
): Promise<AuthState> {
    const token = String(formData.get('token') || '');
    const password = String(formData.get('password') || '');
    const confirm = String(formData.get('password_confirm') || '');
    if (password.length < 8)
        return { error: 'La contraseña debe tener al menos 8 caracteres.' };
    if (password !== confirm) return { error: 'Las contraseñas no coinciden.' };

    const service = createServiceClient();
    const company = await fetchCompanyByResetToken(service, token);
    if (!company || !company.orderUserId)
        return { error: 'El enlace no es válido. Pedí uno nuevo.' };
    if (
        company.resetExpiresAt &&
        new Date(company.resetExpiresAt).getTime() < Date.now()
    ) {
        return { error: 'El enlace venció. Pedí uno nuevo.' };
    }

    const { error: pwErr } = await service.rpc('admin_set_password', {
        p_user_id: company.orderUserId,
        p_password: password
    });
    if (pwErr) return { error: 'No se pudo cambiar la contraseña. Probá de nuevo.' };

    await service
        .from('companies')
        .update({ reset_token: null, reset_expires_at: null })
        .eq('id', company.id);

    return { message: 'Contraseña actualizada. Ya podés iniciar sesión.' };
}

export async function signInAction(
    _prev: AuthState | undefined,
    formData: FormData
): Promise<AuthState> {
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    revalidatePath('/', 'layout');
    redirect(landingPath(data.user?.email));
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
