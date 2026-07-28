'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    createProduct,
    updateProduct,
    deleteProduct,
    uploadProductImage,
    ProductInput
} from '@/lib/services/products';

export type SaveProductResult = { ok: true } | { ok: false; error: string };

// Turns a raw Supabase/Postgres error into a friendly Spanish message.
// Server Action errors are redacted in production, so we return this as
// data (return values cross the RSC boundary intact) instead of throwing.
function toFriendlyError(err: unknown, code: string): string {
    const e = err as { code?: string; message?: string } | null;
    if (e?.code === '23505') {
        return `Ya existe un producto con el código "${code}". Usá un código distinto.`;
    }
    return e?.message || 'No se pudo guardar el producto.';
}

export async function createProductAction(
    input: ProductInput
): Promise<SaveProductResult> {
    try {
        const supabase = await createClient();
        await createProduct(supabase, input);
        revalidatePath('/admin/products');
        return { ok: true };
    } catch (err) {
        return { ok: false, error: toFriendlyError(err, input.productCode) };
    }
}

export async function updateProductAction(
    uuid: string,
    input: ProductInput
): Promise<SaveProductResult> {
    try {
        const supabase = await createClient();
        await updateProduct(supabase, uuid, input);
        revalidatePath('/admin/products');
        return { ok: true };
    } catch (err) {
        return { ok: false, error: toFriendlyError(err, input.productCode) };
    }
}

export async function deleteProductAction(uuid: string) {
    const supabase = await createClient();
    await deleteProduct(supabase, uuid);
    revalidatePath('/admin/products');
}

export async function uploadProductImageAction(formData: FormData): Promise<string> {
    const file = formData.get('file');
    if (!(file instanceof File)) {
        throw new Error('No se recibió el archivo');
    }
    if (!file.type.startsWith('image/')) {
        throw new Error('El archivo debe ser una imagen');
    }
    if (file.size > 5 * 1024 * 1024) {
        throw new Error('La imagen supera el límite de 5 MB');
    }
    const supabase = await createClient();
    return uploadProductImage(supabase, file);
}
