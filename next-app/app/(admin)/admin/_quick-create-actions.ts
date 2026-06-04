'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { isAdminEmail } from '@/lib/admin-acting-company';
import { fetchCompanies, type Company } from '@/lib/services/companies';
import { fetchLogos, type Logo } from '@/lib/services/logos';
import {
    fetchCatalogForCompany,
    type AdminProduct
} from '@/lib/services/products';
import { createOrder } from '@/lib/services/orders';
import type { CartItem, CustomerForm } from '@/lib/types';

// Dependencies the quick-create popups need, fetched on demand the first
// time the admin opens a create modal from a fast action — so the data
// isn't loaded on every page, only when actually used.
export interface QuickCreateDeps {
    companies: Company[];
    logos: Logo[];
}

async function requireAdmin() {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!isAdminEmail(user?.email)) throw new Error('No autorizado');
    return { supabase, user: user! };
}

export async function fetchQuickCreateDepsAction(): Promise<QuickCreateDeps> {
    const { supabase } = await requireAdmin();
    // Companies are required; logos are best-effort so a logos-table
    // hiccup can't block the product popup (the BOM logo picker just
    // shows empty in that case).
    const [companies, logos] = await Promise.all([
        fetchCompanies(supabase),
        fetchLogos(supabase).catch(() => [])
    ]);
    return { companies, logos };
}

// Catalog (with images) for the simplified order popup, loaded once the
// admin picks the company they're ordering for.
export async function fetchCompanyCatalogAction(
    companyId: string
): Promise<AdminProduct[]> {
    const { supabase } = await requireAdmin();
    return fetchCatalogForCompany(supabase, companyId);
}

export interface QuickOrderResult {
    error?: string;
    orderRef?: string;
}

// Create an order on behalf of a company straight from the popup. Unlike
// the customer checkout flow this takes the company id explicitly (no
// acting-company cookie dance) since the admin picked it in the modal.
export async function createQuickOrderAction(
    companyId: string,
    cart: CartItem[],
    extra: { notes?: string; deliveryDate?: string }
): Promise<QuickOrderResult> {
    if (!companyId) return { error: 'Elegí una empresa.' };
    if (!cart || cart.length === 0) return { error: 'Agregá al menos un producto.' };
    const { supabase, user } = await requireAdmin();
    const form: CustomerForm = {
        name: '',
        company: '',
        email: '',
        phone: '',
        notes: extra.notes || '',
        date: extra.deliveryDate || '',
        purchaseOrder: ''
    };
    try {
        const result = await createOrder(supabase, user.id, form, cart, companyId);
        revalidatePath('/admin/orders');
        return { orderRef: result.orderRef };
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo guardar el pedido.';
        return { error: msg };
    }
}
