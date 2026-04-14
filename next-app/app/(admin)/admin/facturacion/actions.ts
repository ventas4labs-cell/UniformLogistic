'use server';

import { revalidatePath } from 'next/cache';
import { saveFeConfig, uploadCertificate, type FeConfigForm } from '@/lib/services/feConfig';

export async function saveFeConfigAction(form: FeConfigForm): Promise<void> {
    await saveFeConfig(form);
    revalidatePath('/admin/facturacion');
}

export async function uploadCertificateAction(formData: FormData): Promise<string> {
    const file = formData.get('file');
    if (!(file instanceof File)) {
        throw new Error('No se recibió el archivo .p12');
    }
    return uploadCertificate(file);
}
