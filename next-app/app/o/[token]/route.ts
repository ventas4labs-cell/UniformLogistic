// ─── Company order-link entry point ─────────────────────────────────
// Each empresa is given a bookmark like https://app/o/<accessToken>.
// It NO LONGER silently signs them in. Instead it lands them on the
// login page, greeting the company by name, where they either log in
// with their email + password or (first time) activate their account.
//
// The token itself is kept OUT of the URL — it rides in a short-lived
// httpOnly cookie so the login/activation flow can identify the company
// and, during rollout, offer the token fallback for accounts that
// haven't set a password yet.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServiceClient } from '@/utils/supabase/server';
import { fetchCompanyByAccessToken } from '@/lib/services/companies';

export const dynamic = 'force-dynamic';

// Short-lived cookie that names the company whose link was opened.
export const COMPANY_LINK_COOKIE = 'ul_company_link';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    const origin = new URL(request.url).origin;

    const fail = (reason: string) =>
        NextResponse.redirect(`${origin}/login?reason=${reason}`);

    if (!token || token.length < 16) {
        return fail('invalid-link');
    }

    const service = createServiceClient();
    const company = await fetchCompanyByAccessToken(service, token);
    if (!company) {
        return fail('invalid-link');
    }

    // Land on login, scoped to this company by its (non-secret) id.
    const response = NextResponse.redirect(
        `${origin}/login?empresa=${company.id}`
    );
    response.cookies.set(COMPANY_LINK_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 30
    });
    return response;
}
