import { createClient } from '@/utils/supabase/server';
import { fetchCompanies } from '@/lib/services/companies';
import { getActingCompanyId, isAdminEmail } from '@/lib/admin-acting-company';
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

    // If admin, resolve the acting company so the form can pre-fill the
    // company name and surface the banner. For customers the company name
    // is whatever was stored in user_metadata at signup.
    let actingCompany: { id: string; name: string } | null = null;
    let companyName = meta.company_name || '';
    if (isAdminEmail(user.email)) {
        const actingId = await getActingCompanyId();
        if (actingId) {
            const companies = await fetchCompanies(supabase);
            const match = companies.find((c) => c.id === actingId);
            if (match) {
                actingCompany = { id: match.id, name: match.name };
                companyName = match.name;
            }
        }
    }

    const initial = {
        name: meta.full_name || '',
        company: companyName,
        email: user.email || '',
        phone: meta.phone || '',
        notes: '',
        date: deliveryDate,
        purchaseOrder: '',
    };

    return <CheckoutForm initial={initial} actingCompany={actingCompany} />;
}
