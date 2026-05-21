import { createClient } from '@/utils/supabase/server';
import {
    fetchCatalogForCompany,
    fetchCatalogForUser
} from '@/lib/services/products';
import { getActingCompanyId, isAdminEmail } from '@/lib/admin-acting-company';
import { CartReview } from './cart-review';

export default async function CartPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // For admin: index against the acting company's catalog so product
    // names/images resolve. If admin hasn't picked a company yet, fall
    // through to the user-scoped fetch (returns empty for admin) — the
    // cart will still render with raw product codes as fallback.
    const catalog = isAdminEmail(user.email)
        ? await (async () => {
              const actingId = await getActingCompanyId();
              return actingId ? fetchCatalogForCompany(supabase, actingId) : [];
          })()
        : await fetchCatalogForUser(supabase, user.id);

    const index = Object.fromEntries(
        catalog.map((p) => [p.id, { name: p.name, image: p.image }])
    );

    return <CartReview productIndex={index} />;
}
