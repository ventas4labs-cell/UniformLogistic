'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    clearActingCompanyId,
    isAdminEmail,
    setActingCompanyId
} from '@/lib/admin-acting-company';

// ─── Acting-as-company picker actions ────────────────────────────────
//
// Only the admin user can flip the acting company. The check is the
// same hard-coded email gate used in app/(admin)/admin/layout.tsx and
// the admin API routes. We revalidate the customer shell (catalog,
// cart, checkout) so the next render reads the freshly-set cookie.

async function requireAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    return isAdminEmail(user.email);
}

export async function setActingCompanyAction(companyId: string): Promise<{ error?: string }> {
    if (!(await requireAdmin())) return { error: 'No autorizado.' };
    if (!companyId) return { error: 'Falta el id de empresa.' };
    await setActingCompanyId(companyId);
    revalidatePath('/catalog');
    revalidatePath('/cart');
    revalidatePath('/checkout');
    return {};
}

export async function clearActingCompanyAction(): Promise<void> {
    if (!(await requireAdmin())) return;
    await clearActingCompanyId();
    revalidatePath('/catalog');
    revalidatePath('/cart');
    revalidatePath('/checkout');
}
