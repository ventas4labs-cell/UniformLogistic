// ─── Landing page — Uniform Logistic ─────────────────────────────────
// Ultra-minimal, editorial "cutting-room" landing: warm ivory + ink +
// brand orange, TT Norms Pro Condensed display type, GSAP motion
// (sunrise hero reveal, scroll-staggered sections, parallax glows,
// floating portal mockup). Sections live in components/landing/*; all
// animation wiring is centralized in landing-page.tsx.
//
// The root URL always shows the landing page (it's the "main link" we
// share). Logged-in visitors aren't redirected away — the nav swaps
// Iniciar/Registrarse for an "Ir a la app" button into their dashboard.

import { createClient } from '@/utils/supabase/server';
import { landingPath } from '@/lib/admin-acting-company';
import { fetchStationUser } from '@/lib/services/station-users';
import { LandingPage } from '@/components/landing/landing-page';

export default async function Home() {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();

    // Route each account to its real home. A station user (e.g. after
    // opening an /s/<token> link) belongs on the restricted /station
    // shell — sending them to landingPath()'s /home just bounces through
    // the (app) layout to /station anyway, which looks like a bug. The
    // nav also exposes a sign-out so the owner isn't stuck on /station.
    let appHref: string | null = null;
    if (user) {
        const station = await fetchStationUser(supabase, user.id);
        appHref = station ? '/station' : landingPath(user.email);
    }

    return <LandingPage appHref={appHref} isAuthed={!!user} />;
}
