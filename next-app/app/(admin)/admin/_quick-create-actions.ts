'use server';

import { createClient } from '@/utils/supabase/server';
import { isAdminEmail } from '@/lib/admin-acting-company';
import { fetchCompanies, type Company } from '@/lib/services/companies';
import { fetchLogos, type Logo } from '@/lib/services/logos';

// Dependencies the quick-create popups need, fetched on demand the first
// time the admin opens a create modal from a fast action — so the data
// isn't loaded on every page, only when actually used.
export interface QuickCreateDeps {
    companies: Company[];
    logos: Logo[];
}

export async function fetchQuickCreateDepsAction(): Promise<QuickCreateDeps> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!isAdminEmail(user?.email)) {
        throw new Error('No autorizado');
    }
    const [companies, logos] = await Promise.all([
        fetchCompanies(supabase),
        fetchLogos(supabase)
    ]);
    return { companies, logos };
}
