'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createProduct, updateProduct, deleteProduct, ProductInput } from '@/lib/services/products';

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
