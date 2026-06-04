// ─── Station custom-link entry point ───────────────────────────────
// Each external station is given a bookmark like
//     https://app/s/<accessToken>
// where <accessToken> is a stable random slug stored on station_users.
// Visiting it server-side:
//   1. Looks the station up by access_token (service-role read; the
//      column has a unique index).
//   2. signInWithPassword on the cookie-bound supabase client using
//      the token itself as the password (createStationUserAction set
//      it that way at creation; regenerate rotates both in lockstep).
//   3. Redirects the now-authenticated station user to /station.
//
// On any failure we send them to /login with a tiny query string so
// they understand the link is invalid rather than the app being
// broken.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { fetchStationUserByAccessToken } from '@/lib/services/station-users';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    const origin = new URL(request.url).origin;

    if (!token || token.length < 16) {
        return NextResponse.redirect(`${origin}/login?reason=invalid-link`);
    }

    const service = createServiceClient();
    const station = await fetchStationUserByAccessToken(service, token);
    if (!station) {
        return NextResponse.redirect(`${origin}/login?reason=invalid-link`);
    }

    // Cookie-bound client — signInWithPassword writes the session
    // cookies via the cookies() adapter on this request, so the next
    // request (the redirect target) sees the station as signed in.
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
        email: station.email,
        password: token
    });
    if (error) {
        return NextResponse.redirect(`${origin}/login?reason=signin-failed`);
    }

    return NextResponse.redirect(`${origin}/station`);
}
