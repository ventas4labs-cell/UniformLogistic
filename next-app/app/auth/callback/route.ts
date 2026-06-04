import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { landingPath } from '@/lib/admin-acting-company';

// Supabase OAuth redirects here with `?code=...`. We exchange the code for a
// session, then send the user to their landing page — admin to the admin
// panel home, everyone else to /home — or to an explicit ?next= if provided.
export async function GET(request: Request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const explicitNext = url.searchParams.get('next');

    let next = explicitNext || '/home';

    if (code) {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
            return NextResponse.redirect(
                new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
            );
        }
        // Only override the default when the caller didn't request a
        // specific destination, so deep-link returns still work.
        if (!explicitNext) next = landingPath(data.user?.email);
    }
    return NextResponse.redirect(new URL(next, url.origin));
}
