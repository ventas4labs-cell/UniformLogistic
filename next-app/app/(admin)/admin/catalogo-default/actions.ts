'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    createCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
    uploadCatalogImage,
    type CatalogItem,
    type CatalogItemInput
} from '@/lib/services/catalog-items';
import { isAdminEmail } from '@/lib/admin-acting-company';

// Defence in depth: the (admin) layout redirect does NOT protect server
// actions — an action runs and commits before that render pass, and it is
// addressed by action id, so it can be POSTed from any page the caller can
// load. Every mutation re-checks that the caller is the admin.
async function assertAdmin(): Promise<void> {
    const _sb = await createClient();
    const {
        data: { user }
    } = await _sb.auth.getUser();
    if (!user || !isAdminEmail(user.email)) throw new Error('No autorizado.');
}


const REVAL_PATHS = ['/admin/catalogo-default', '/admin/cotizador', '/cotizar'];

// Returns the created row so the client can hold the REAL id (and real
// timestamps). Previously this returned void and the client fabricated
// a crypto.randomUUID() id — which made the next edit run
// update(...).eq('id', fakeId), matching 0 rows and throwing PGRST116.
export async function createCatalogItemAction(
    input: CatalogItemInput
): Promise<CatalogItem> {
    await assertAdmin();
    const supabase = await createClient();
    const item = await createCatalogItem(supabase, input);
    for (const p of REVAL_PATHS) revalidatePath(p);
    return item;
}

export async function updateCatalogItemAction(
    id: string,
    input: CatalogItemInput
): Promise<CatalogItem> {
    await assertAdmin();
    const supabase = await createClient();
    const item = await updateCatalogItem(supabase, id, input);
    for (const p of REVAL_PATHS) revalidatePath(p);
    return item;
}

export async function deleteCatalogItemAction(id: string) {
    await assertAdmin();
    const supabase = await createClient();
    await deleteCatalogItem(supabase, id);
    for (const p of REVAL_PATHS) revalidatePath(p);
}

// Image upload arrives as FormData because Server Actions can't
// accept File objects directly (they can, but Next serializes them —
// FormData is the framework-blessed path).
export async function uploadCatalogImageAction(formData: FormData): Promise<string> {
    await assertAdmin();
    const file = formData.get('file');
    if (!(file instanceof File)) throw new Error('No se recibió el archivo.');
    const supabase = await createClient();
    return uploadCatalogImage(supabase, file);
}
