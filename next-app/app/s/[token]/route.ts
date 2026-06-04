// ─── Station custom-link entry point ───────────────────────────────
// Each external station is given a bookmark like
//     https://app/s/<accessToken>
// where <accessToken> is a stable random slug stored on station_users.
// Visiting it server-side:
//   1. Looks the station up by access_token (service-role read; the
//      column has a unique index).
//   2. signInWithPassword using the token itself as the password
//      (createStationUserAction set it that way at creation;
//      regenerate rotates both in lockstep).
//   3. Redirects the now-authenticated station user to /station.
//
// IMPORTANT: the supabase client is bound to the *redirect response's*
// cookie jar, not next/headers cookies(). signInWithPassword writes
// the session cookies onto the redirect response so they actually ride
// along with the 302 — and crucially they OVERWRITE any existing
// session (e.g. an admin testing the link while logged in). Using the
// next/headers cookies() store here would leave the admin's session
// untouched, so /station would see the admin (not a station user) and
// bounce to /home.
//
// On any failure we send them to /login with a query string so they
// understand the link is invalid rather than the app being broken.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/utils/supabase/server';
import { fetchStationUserByAccessToken } from '@/lib/services/station-users';

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

    // Look up the station with the service-role client (bypasses RLS).
    const service = createServiceClient();
    const station = await fetchStationUserByAccessToken(service, token);
    if (!station) {
        return fail('invalid-link');
    }

    // Build the success redirect up front so the supabase client can
    // write session cookies directly onto it.
    const response = NextResponse.redirect(`${origin}/station`);

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
        email: station.email,
        password: token
    });
    if (error) {
        return fail('signin-failed');
    }

    return response;
}
