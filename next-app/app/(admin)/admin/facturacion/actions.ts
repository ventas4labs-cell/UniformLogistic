'use server';

import { revalidatePath } from 'next/cache';
import { saveFeConfig, uploadCertificate, type FeConfigForm } from '@/lib/services/feConfig';
import { isAdminEmail } from '@/lib/admin-acting-company';
import { createClient } from '@/utils/supabase/server';

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


export async function saveFeConfigAction(form: FeConfigForm): Promise<void> {
    await assertAdmin();
    await saveFeConfig(form);
    revalidatePath('/admin/facturacion');
}

export async function uploadCertificateAction(formData: FormData): Promise<string> {
    await assertAdmin();
    const file = formData.get('file');
    if (!(file instanceof File)) {
        throw new Error('No se recibió el archivo .p12');
    }
    return uploadCertificate(file);
}
