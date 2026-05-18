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

export async function createProductAction(input: ProductInput) {
    const supabase = await createClient();
    await createProduct(supabase, input);
    revalidatePath('/admin/products');
}

export async function updateProductAction(uuid: string, input: ProductInput) {
    const supabase = await createClient();
    await updateProduct(supabase, uuid, input);
    revalidatePath('/admin/products');
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
