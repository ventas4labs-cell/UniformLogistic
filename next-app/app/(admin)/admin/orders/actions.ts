'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    updateOrderStatus,
    deleteOrder,
    updateOrderFull,
    createOrder,
    OrderStatus,
    UpdateOrderHeaderInput,
    OrderItemInput
} from '@/lib/services/orders';
import { resolveReport, unresolveReport } from '@/lib/services/missing-insumos';
import {
    fetchFastOrderRequest,
    updateFastOrderRequestStatus,
    ensureWebCompany
} from '@/lib/services/fast-orders';
import type { CartItem, CustomerForm } from '@/lib/types';

export async function updateOrderStatusAction(orderUuid: string, status: OrderStatus) {
    const supabase = await createClient();
    await updateOrderStatus(supabase, orderUuid, status);
    revalidatePath('/admin/orders');
}

export async function deleteOrderAction(orderUuid: string) {
    const supabase = await createClient();
    await deleteOrder(supabase, orderUuid);
    revalidatePath('/admin/orders');
    revalidatePath('/admin/operador');
}

export async function updateOrderAction(
    orderUuid: string,
    header: UpdateOrderHeaderInput,
    items: OrderItemInput[]
) {
    const supabase = await createClient();
    await updateOrderFull(supabase, orderUuid, header, items);
    revalidatePath('/admin/orders');
    revalidatePath('/admin/operador');
}

// Inline notifications: missing-insumo reports surface as a bell on
// each affected order card. Resolving/reopening lives here now that
// the standalone /admin/notificaciones page is gone.
export async function resolveOrderReportAction(reportId: string) {
    const supabase = await createClient();
    await resolveReport(supabase, reportId);
    revalidatePath('/admin/orders');
}

export async function unresolveOrderReportAction(reportId: string) {
    const supabase = await createClient();
    await unresolveReport(supabase, reportId);
    revalidatePath('/admin/orders');
}

// ── Fast-order requests (Pedido rápido / Solicitudes) ────────────────

// Accept a public fast-order request → create a real order. The customer
// has no empresa, so the order is attached to the house "Pedidos Web"
// company and the real contact + per-line colours are captured in the
// order notes. Then the request is flagged converted.
export async function acceptFastOrderRequestAction(
    requestId: string
): Promise<{ ok: boolean; orderRef?: string; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'No autenticado.' };

    const req = await fetchFastOrderRequest(supabase, requestId);
    if (!req) return { ok: false, error: 'Solicitud no encontrada.' };
    if (req.status === 'converted')
        return { ok: false, error: 'Ya fue convertida en pedido.' };
    if (req.items.length === 0)
        return { ok: false, error: 'La solicitud no tiene productos.' };

    const cart: CartItem[] = req.items.map((it) => ({
        productId: it.productCode,
        productName: it.productName,
        selection: it.selection,
        quantity: it.quantity
    }));

    const contactLine = [req.contactEmail, req.contactPhone]
        .filter(Boolean)
        .join(' · ');
    const itemLines = req.items
        .map(
            (it) =>
                `- ${it.productName} · ${it.size}${
                    it.color ? ` · ${it.color}` : ''
                } × ${it.quantity}`
        )
        .join('\n');
    const noteParts = [
        `Pedido rápido web ${req.requestRef}`,
        `Contacto: ${req.contactName}${contactLine ? ` · ${contactLine}` : ''}`,
        req.companyName ? `Empresa: ${req.companyName}` : '',
        itemLines,
        req.notes ? `Nota del cliente: ${req.notes}` : ''
    ].filter(Boolean);

    const form: CustomerForm = {
        name: req.contactName,
        company: req.companyName,
        email: req.contactEmail,
        phone: req.contactPhone,
        notes: noteParts.join('\n'),
        date: '',
        purchaseOrder: ''
    };

    try {
        const companyId = await ensureWebCompany(supabase);
        const result = await createOrder(supabase, user.id, form, cart, companyId);
        await updateFastOrderRequestStatus(
            supabase,
            requestId,
            'converted',
            result.id
        );
        revalidatePath('/admin/orders');
        revalidatePath('/admin/operador');
        return { ok: true, orderRef: result.orderRef };
    } catch (e) {
        return {
            ok: false,
            error: e instanceof Error ? e.message : 'No se pudo crear el pedido.'
        };
    }
}

export async function rejectFastOrderRequestAction(
    requestId: string
): Promise<{ ok: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        await updateFastOrderRequestStatus(supabase, requestId, 'rejected');
        revalidatePath('/admin/orders');
        return { ok: true };
    } catch (e) {
        return {
            ok: false,
            error: e instanceof Error ? e.message : 'No se pudo rechazar.'
        };
    }
}
