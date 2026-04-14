import { createClient } from '@/utils/supabase/server';
import { CheckoutForm } from './checkout-form';

function addBusinessDays(startDate: Date, days: number) {
    const cur = new Date(startDate);
    let added = 0;
    while (added < days) {
        cur.setDate(cur.getDate() + 1);
        if (cur.getDay() !== 0 && cur.getDay() !== 6) added++;
    }
    return cur;
}

export default async function CheckoutPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const meta = (user.user_metadata || {}) as Record<string, string | undefined>;
    const deliveryDate = addBusinessDays(new Date(), 30).toISOString().split('T')[0];

    const initial = {
        name: meta.full_name || '',
        company: meta.company_name || '',
        email: user.email || '',
        phone: meta.phone || '',
        notes: '',
        date: deliveryDate,
        purchaseOrder: '',
    };

    return <CheckoutForm initial={initial} />;
}
