'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    createStationInvoice,
    uploadStationInvoiceImage
} from '@/lib/services/station-invoices';

/**
 * Upload a single invoice image into the station-invoices bucket.
 * Returns the public URL so the client can show a preview and pass
 * it back to submitStationInvoiceAction.
 *
 * Auth: server-derived user id is the upload prefix, so a station
 * user can never overwrite another station's folder.
 */
export async function uploadStationInvoiceImageAction(
    formData: FormData
): Promise<string> {
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
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');
    return uploadStationInvoiceImage(supabase, user.id, file);
}

export async function submitStationInvoiceAction(input: {
    imageUrl: string;
    amount?: number | null;
    notes?: string;
    orderId?: string | null;
}): Promise<void> {
    if (!input.imageUrl) throw new Error('Falta la imagen de la factura');
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');
    await createStationInvoice(supabase, {
        stationUserId: user.id,
        imageUrl: input.imageUrl,
        amount: input.amount ?? null,
        notes: input.notes,
        orderId: input.orderId ?? null
    });
    revalidatePath('/station');
    revalidatePath('/admin/station-invoices');
}
