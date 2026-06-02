'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { setProductAssignment } from '@/lib/services/companyCatalog';
import { isAdminEmail } from '@/lib/admin-acting-company';

// Toggles a single product↔company assignment from the company detail
// page. Reused for both assign and unassign. Layout already gates
// /admin/* to admin; we re-check the email here as defense-in-depth.
export async function setCompanyProductAssignmentAction(
    companyId: string,
    productUuid: string,
    assigned: boolean
): Promise<{ error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado.' };
    if (!isAdminEmail(user.email)) return { error: 'No autorizado.' };

    try {
        await setProductAssignment(supabase, companyId, productUuid, assigned);
    } catch (err) {
        return {
            error: err instanceof Error ? err.message : 'Error desconocido al asignar.'
        };
    }
    revalidatePath(`/admin/companies/${companyId}`);
    revalidatePath('/admin/products');
    revalidatePath('/admin/orders');
    return {};
}
