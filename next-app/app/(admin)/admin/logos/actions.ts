'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    createLogo,
    updateLogo,
    deleteLogo,
    uploadLogoImage,
    LogoInput
} from '@/lib/services/logos';

export async function createLogoAction(input: LogoInput) {
    const supabase = await createClient();
    await createLogo(supabase, input);
    revalidatePath('/admin/logos');
    revalidatePath('/admin/products');
}

export async function updateLogoAction(id: string, input: LogoInput) {
    const supabase = await createClient();
    await updateLogo(supabase, id, input);
    revalidatePath('/admin/logos');
    revalidatePath('/admin/products');
}

export async function deleteLogoAction(id: string) {
    const supabase = await createClient();
    await deleteLogo(supabase, id);
    revalidatePath('/admin/logos');
    revalidatePath('/admin/products');
}

export async function uploadLogoImageAction(formData: FormData): Promise<string> {
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
    return uploadLogoImage(supabase, file);
}
