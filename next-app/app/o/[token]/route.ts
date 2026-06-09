// ─── Company order-link entry point ─────────────────────────────────
// Each empresa is given a bookmark like
//     https://app/o/<accessToken>
// where <accessToken> is a stable random slug stored on companies.
// Visiting it server-side:
//   1. Looks the company up by access_token (service-role read; the
//      column has a unique index).
//   2. signInWithPassword as the company's order user, using the token
//      itself as the password (provisionOrderLink set it that way;
//      regenerate rotates both in lockstep).
//   3. Redirects the now-authenticated company user to /catalog.
//
// Same cookie-jar mechanics as the station /s/[token] route: session
// cookies are written onto the *redirect response* so they ride the
// 302 and overwrite any existing session (e.g. an admin testing the
// link while logged in).

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/utils/supabase/server';
import { fetchCompanyByAccessToken } from '@/lib/services/companies';

export const dynamic = 'force-dynamic';

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
    if (!company || !company.orderUserEmail) {
        return fail('invalid-link');
    }

    // Build the success redirect up front so the supabase client can
    // write session cookies directly onto it.
    const response = NextResponse.redirect(`${origin}/catalog`);

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                }
            }
        }
    );

    const { error } = await supabase.auth.signInWithPassword({
        email: company.orderUserEmail,
        password: token
    });
    if (error) {
        return fail('signin-failed');
    }

    return response;
}
