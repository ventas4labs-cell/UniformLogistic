// ─── Company account activation (email confirmation) ────────────────
// Reached from the "Activá tu cuenta" button in the confirmation email.
// Validates the one-time token, flips the auth user's email from the
// synthetic placeholder to the company's real (now-confirmed) email —
// which is what finally lets them sign in with it — and marks the
// account active. Then lands them on login, greeted, ready to sign in.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServiceClient } from '@/utils/supabase/server';
import { fetchCompanyByActivationToken } from '@/lib/services/companies';

export const dynamic = 'force-dynamic';

const COMPANY_LINK_COOKIE = 'ul_company_link';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    const origin = new URL(request.url).origin;
    const back = (reason: string, empresa?: string) =>
        NextResponse.redirect(
            `${origin}/login?reason=${reason}${empresa ? `&empresa=${empresa}` : ''}`
        );

    if (!token || token.length < 16) return back('activation-invalid');

    const service = createServiceClient();
    const company = await fetchCompanyByActivationToken(service, token);
    if (!company || !company.orderUserId || !company.pendingEmail) {
        return back('activation-invalid');
    }
    if (company.activatedAt) {
        // Already confirmed (e.g. link clicked twice) — just send to login.
        return back('activation-done', company.id);
    }
    if (
        company.activationExpiresAt &&
        new Date(company.activationExpiresAt).getTime() < Date.now()
    ) {
        return back('activation-expired', company.id);
    }

    // Flip the auth user's email to the confirmed real email (and keep it
    // confirmed) — this is what enables email+password sign-in for them.
    // Uses the SQL RPC (the HTTP admin API isn't reachable here) which
    // also syncs auth.identities.
    const { error: authErr } = await service.rpc('company_confirm_email', {
        p_user_id: company.orderUserId,
        p_email: company.pendingEmail
    });
    if (authErr) {
        // Most likely the email is already used by another auth user.
        return back('activation-email-taken', company.id);
    }

    const now = new Date().toISOString();
    const { error: upErr } = await service
        .from('companies')
        .update({
            email: company.pendingEmail,
            email_confirmed_at: now,
            activated_at: now,
            pending_email: null,
            activation_token: null,
            activation_expires_at: null
        })
        .eq('id', company.id);
    if (upErr) return back('activation-failed', company.id);

    // Greet them on the login page and let them sign in.
    const response = NextResponse.redirect(
        `${origin}/login?reason=activated&empresa=${company.id}`
    );
    response.cookies.set(COMPANY_LINK_COOKIE, company.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 30
    });
    return response;
}
