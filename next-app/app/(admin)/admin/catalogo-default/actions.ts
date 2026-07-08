'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    createCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
    uploadCatalogImage,
    type CatalogItemInput
} from '@/lib/services/catalog-items';

const REVAL_PATHS = ['/admin/catalogo-default', '/admin/cotizador', '/cotizar'];

export async function createCatalogItemAction(input: CatalogItemInput) {
    const supabase = await createClient();
    await createCatalogItem(supabase, input);
    for (const p of REVAL_PATHS) revalidatePath(p);
}

export async function updateCatalogItemAction(id: string, input: CatalogItemInput) {
    const supabase = await createClient();
    await updateCatalogItem(supabase, id, input);
    for (const p of REVAL_PATHS) revalidatePath(p);
}

export async function deleteCatalogItemAction(id: string) {
    const supabase = await createClient();
    await deleteCatalogItem(supabase, id);
    for (const p of REVAL_PATHS) revalidatePath(p);
}

// Image upload arrives as FormData because Server Actions can't
// accept File objects directly (they can, but Next serializes them —
// FormData is the framework-blessed path).
export async function uploadCatalogImageAction(formData: FormData): Promise<string> {
    const file = formData.get('file');
    if (!(file instanceof File)) throw new Error('No se recibió el archivo.');
    const supabase = await createClient();
    return uploadCatalogImage(supabase, file);
}
