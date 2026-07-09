'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    updateThreeDModel,
    deleteThreeDModel,
    updateDesignRequestStatus,
    fetchDesignRequest,
    type ThreeDModelInput,
    type DesignStatus
} from '@/lib/services/three-d-models';
import { setCompanyCustomOrderEnabled } from '@/lib/services/companies';
import { createOrder } from '@/lib/services/orders';
import type { CartItem, CustomerForm } from '@/lib/types';

// Route gate at (admin)/admin/layout.tsx already restricts these to the
// admin email, same as the other admin modules (catalogo-default etc.).
const REVAL_PATHS = ['/admin/3d-models', '/custom-order', '/catalog'];

export async function updateModelAction(id: string, input: ThreeDModelInput) {
    const supabase = await createClient();
    await updateThreeDModel(supabase, id, input);
    for (const p of REVAL_PATHS) revalidatePath(p);
}

export async function deleteModelAction(id: string) {
    const supabase = await createClient();
    await deleteThreeDModel(supabase, id);
    for (const p of REVAL_PATHS) revalidatePath(p);
}

export async function updateDesignStatusAction(id: string, status: DesignStatus) {
    const supabase = await createClient();
    await updateDesignRequestStatus(supabase, id, status);
    revalidatePath('/admin/3d-models');
}

export async function setCompanyCustomOrderEnabledAction(companyId: string, enabled: boolean) {
    const supabase = await createClient();
    await setCompanyCustomOrderEnabled(supabase, companyId, enabled);
    for (const p of REVAL_PATHS) revalidatePath(p);
}

// Accept a design request → create a real order for the linked product +
// chosen sizes, with the design details captured in the order notes.
export async function acceptDesignRequestAction(
    requestId: string
): Promise<{ ok: boolean; orderRef?: string; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'No autenticado.' };

    const req = await fetchDesignRequest(supabase, requestId);
    if (!req) return { ok: false, error: 'Solicitud no encontrada.' };
    if (req.status === 'converted') return { ok: false, error: 'Ya fue convertida en pedido.' };
    if (!req.companyId) return { ok: false, error: 'La solicitud no tiene empresa.' };
    if (!req.productCode) return { ok: false, error: 'La solicitud no tiene un producto vinculado.' };
    if (req.items.length === 0) return { ok: false, error: 'La solicitud no tiene tallas.' };

    const cart: CartItem[] = req.items.map((it) => ({
        productId: req.productCode,
        productName: req.productName || req.productCode,
        selection: it.selection,
        quantity: it.quantity
    }));

    const logoLines = req.logos
        .map((l) => `${l.zoneLabel}: ${l.logoName || '—'}`)
        .join(' · ');
    const noteParts = [
        `Pedido 3D ${req.requestRef} · ${req.modelName}`,
        req.colorName ? `Color: ${req.colorName}` : '',
        logoLines ? `Logos: ${logoLines}` : '',
        req.previewUrl ? `Vista: ${req.previewUrl}` : '',
        req.notes
    ].filter(Boolean);

    const form: CustomerForm = {
        name: '',
        company: req.companyName,
        email: '',
        phone: '',
        notes: noteParts.join('\n'),
        date: '',
        purchaseOrder: ''
    };

    try {
        const result = await createOrder(supabase, user.id, form, cart, req.companyId);
        await updateDesignRequestStatus(supabase, requestId, 'converted');
        for (const p of REVAL_PATHS) revalidatePath(p);
        return { ok: true, orderRef: result.orderRef };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'No se pudo crear el pedido.' };
    }
}
