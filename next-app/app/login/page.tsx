import { createClient, createServiceClient } from '@/utils/supabase/server';
import { fetchCompanyActivation } from '@/lib/services/companies';
import { LoginForm } from './login-form';

// The login page must ALWAYS render the form — never redirect an already
// authenticated user away. A station user reaching /login would otherwise
// bounce /login → /home → /station (the (app) layout sends stations to
// /station), trapping them with no way to switch accounts. Instead we show
// the current session and let them sign out to get back into the system.
//
// When reached from a company link (/o/<token> → /login?empresa=<id>), we
// greet the company by name and prefill their email.
// Maps the ?reason=<code> the activation/confirmation routes redirect back
// with to a banner the login page shows. `ok` picks the green vs red style.
const REASON_NOTICES: Record<string, { ok: boolean; text: string }> = {
    activated: {
        ok: true,
        text: '¡Cuenta activada! Ya podés iniciar sesión con tu correo y contraseña.'
    },
    'activation-done': {
        ok: true,
        text: 'Tu cuenta ya estaba activa. Iniciá sesión con tu correo y contraseña.'
    },
    'activation-invalid': {
        ok: false,
        text: 'El enlace de activación no es válido. Volvé a abrir el enlace de tu empresa.'
    },
    'activation-expired': {
        ok: false,
        text: 'El enlace de activación venció. Reenviá el correo de confirmación e intentá de nuevo.'
    },
    'activation-email-taken': {
        ok: false,
        text: 'Ese correo ya está registrado con otra cuenta. Usá otro o escribinos para ayudarte.'
    },
    'activation-failed': {
        ok: false,
        text: 'No pudimos activar tu cuenta. Probá de nuevo o escribinos para ayudarte.'
    }
};

export default async function LoginPage({
    searchParams
}: {
    searchParams: Promise<{ empresa?: string; reason?: string }>;
}) {
    const { empresa, reason } = await searchParams;
    const notice = (reason && REASON_NOTICES[reason]) || null;
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();

    let company: {
        name: string;
        prefillEmail: string;
        activated: boolean;
        passwordSet: boolean;
    } | null = null;
    if (empresa) {
        const svc = createServiceClient();
        const c = await fetchCompanyActivation(svc, empresa).catch(() => null);
        if (c) {
            company = {
                name: c.name,
                prefillEmail: c.email ?? c.pendingEmail ?? '',
                activated: !!c.activatedAt,
                passwordSet: !!c.passwordSetAt
            };
        }
    }

    return (
        <LoginForm
            currentEmail={user?.email ?? null}
            company={company}
            notice={notice}
        />
    );
}
