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


export async function createLogoAction(input: LogoInput) {
    await assertAdmin();
    const supabase = await createClient();
    await createLogo(supabase, input);
    revalidatePath('/admin/logos');
    revalidatePath('/admin/products');
}

export async function updateLogoAction(id: string, input: LogoInput) {
    await assertAdmin();
    const supabase = await createClient();
    await updateLogo(supabase, id, input);
    revalidatePath('/admin/logos');
    revalidatePath('/admin/products');
}

export async function deleteLogoAction(id: string) {
    await assertAdmin();
    const supabase = await createClient();
    await deleteLogo(supabase, id);
    revalidatePath('/admin/logos');
    revalidatePath('/admin/products');
}

export async function uploadLogoImageAction(formData: FormData): Promise<string> {
    await assertAdmin();
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
