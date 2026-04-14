'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { setProductAssignment } from '@/lib/services/companyCatalog';

export async function saveCatalogAssignmentsAction(
    companyId: string,
    changes: { productUuid: string; assigned: boolean }[]
) {
    const supabase = await createClient();
    await Promise.all(
        changes.map((c) => setProductAssignment(supabase, companyId, c.productUuid, c.assigned))
    );
    revalidatePath('/admin/catalog');
}
