// ─── Station session recovery ────────────────────────────────────────
// Station tablets are kiosks: the page is opened once from the
// bookmark `/s/<accessToken>` and then left running for hours. When the
// Supabase session finally lapses, the next server action returned a
// bare "No autenticado." and the operator lost whatever they had typed.
//
// This endpoint is the silent-reconnect half of the fix. It re-signs the
// station in from the same access token the bookmark uses, writing the
// fresh session cookies onto THIS response so the retried action rides
// along with them. Same credential and same effect as visiting
// `/s/<token>` — it just answers with JSON instead of a redirect, so the
// board can recover in place without a full page bounce.
//
// No new attack surface: `/s/<token>` is already public and accepts the
// very same secret. An unknown or inactive token simply 401s.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/utils/supabase/server';
import { fetchStationUserByAccessToken } from '@/lib/services/station-users';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    let token = '';
    try {
        const body = (await request.json()) as { token?: unknown };
        token = typeof body.token === 'string' ? body.token : '';
    } catch {
        return NextResponse.json({ error: 'bad-request' }, { status: 400 });
    }
    if (token.length < 16) {
        return NextResponse.json({ error: 'invalid-token' }, { status: 401 });
    }

    // Service-role lookup: only an active station matches (same check the
    // /s/<token> entry point makes before signing anyone in).
    const service = createServiceClient();
    const station = await fetchStationUserByAccessToken(service, token);
    if (!station) {
        return NextResponse.json({ error: 'invalid-token' }, { status: 401 });
    }

    // Build the response first so the auth cookies land on it.
    const response = NextResponse.json({ ok: true });
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
        return NextResponse.json({ error: 'signin-failed' }, { status: 401 });
    }

    return response;
}
