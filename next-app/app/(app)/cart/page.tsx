import { createClient } from '@/utils/supabase/server';
import { fetchCatalogForUser } from '@/lib/services/products';
import { CartReview } from './cart-review';

export default async function CartPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const catalog = await fetchCatalogForUser(supabase, user.id);
    const index = Object.fromEntries(
        catalog.map((p) => [p.id, { name: p.name, image: p.image }])
    );

    return <CartReview productIndex={index} />;
}
