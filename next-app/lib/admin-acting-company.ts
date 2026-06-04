// ─── Admin "acting as company" cookie ────────────────────────────────
//
// When the admin user places orders on behalf of a customer company, we
// need to remember which company they picked across navigations
// (catalog → cart → checkout). A single httpOnly cookie stores the
// company UUID. The catalog, cart, and checkout server components read
// it; submitOrderAction uses it to scope the created order.
//
// Customers never interact with this cookie — their company is fixed by
// their company_users link. The cookie is only honored on the admin
// email path.

import 'server-only';
import { cookies } from 'next/headers';

export const ADMIN_EMAIL = 'ulogisticcr@gmail.com';

const COOKIE_NAME = 'ul_admin_acting_company';

// 30 days. The cookie isn't security-sensitive (the server still verifies
// the admin email before honoring it), so a long lifetime just spares the
// admin from re-picking after each session.
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const isAdminEmail = (email: string | null | undefined): boolean =>
    (email || '').trim().toLowerCase() === ADMIN_EMAIL;

// Post-login landing for a given user. Admin goes straight to the admin
// panel home; everyone else to the customer warehouse dashboard. Used by
// the sign-in action, the OAuth callback, and the root + /home guards so
// the admin never lands on the customer-facing /home.
export const landingPath = (email: string | null | undefined): string =>
    isAdminEmail(email) ? '/admin/home' : '/home';

export async function getActingCompanyId(): Promise<string | null> {
    const store = await cookies();
    return store.get(COOKIE_NAME)?.value || null;
}

export async function setActingCompanyId(companyId: string): Promise<void> {
    const store = await cookies();
    store.set(COOKIE_NAME, companyId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: MAX_AGE_SECONDS,
        secure: process.env.NODE_ENV === 'production'
    });
}

export async function clearActingCompanyId(): Promise<void> {
    const store = await cookies();
    store.delete(COOKIE_NAME);
}
