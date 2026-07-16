import type { SupabaseClient } from '@supabase/supabase-js';
import type { CartItem, CustomerForm, Order, SizeSelection } from '@/lib/types';

export type OrderStatus =
    | 'pending'
    | 'bodega'
    | 'corte'
    | 'maquila'
    | 'impresion'
    | 'empaque'
    | 'completed'
    | 'cancelled';

export const ORDER_STATUS_OPTIONS: {
    value: OrderStatus;
    label: string;
    color: string;
}[] = [
    { value: 'pending', label: 'Pendiente', color: 'bg-blue-100 text-blue-800' },
    { value: 'bodega', label: 'Bodega', color: 'bg-purple-100 text-purple-800' },
    { value: 'corte', label: 'Corte', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'maquila', label: 'Maquila', color: 'bg-orange-100 text-orange-800' },
    { value: 'impresion', label: 'Impresión', color: 'bg-pink-100 text-pink-800' },
    { value: 'empaque', label: 'Empaque', color: 'bg-indigo-100 text-indigo-800' },
    { value: 'completed', label: 'Completado', color: 'bg-green-100 text-green-800' },
    { value: 'cancelled', label: 'Cancelado', color: 'bg-red-100 text-red-800' }
];

export const selectionToSizeString = (selection: SizeSelection): string => {
    if (selection.waist) {
        return selection.inseam
            ? `C${selection.waist}" / L${selection.inseam}"`
            : `C${selection.waist}"`;
    }
    const genderPrefix = selection.gender
        ? (selection.gender === 'Men' ? 'Hombre · ' : 'Mujer · ')
        : '';
    return `${genderPrefix}${selection.size || ''}`.trim();
};

const formatOrderRef = (orderNumber: number) =>
    `ORDEN-${String(orderNumber).padStart(5, '0')}`;

export interface CreateOrderResult {
    id: string;
    orderRef: string;
    orderNumber: number;
    createdAt: string;
}

const getCompanyIdForUser = async (
    supabase: SupabaseClient,
    userId: string
): Promise<string> => {
    const { data, error } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    if (!data?.company_id) {
        throw new Error(
            'Tu cuenta aún no está vinculada a una empresa. Contacta al administrador.'
        );
    }
    return data.company_id;
};

export const createOrder = async (
    supabase: SupabaseClient,
    userId: string,
    form: CustomerForm,
    cart: CartItem[],
    // When set, skips the company_users lookup and scopes the order to
    // this company. Used by the admin "place on behalf of" flow — the
    // admin user has no company_users link, so the cookie-resolved
    // companyId is passed in directly.
    companyIdOverride?: string
): Promise<CreateOrderResult> => {
    if (cart.length === 0) throw new Error('El carrito está vacío.');

    const companyId =
        companyIdOverride || (await getCompanyIdForUser(supabase, userId));

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            company_id: companyId,
            created_by: userId,
            estimated_delivery_date: form.date || null,
            notes: form.notes || null,
            purchase_order: form.purchaseOrder || null,
            status: 'pending' as OrderStatus
        })
        .select('id, order_number, created_at')
        .single();

    if (orderError) throw orderError;

    const uniqueCodes = [...new Set(cart.map((i) => i.productId))];
    const { data: productRows } = await supabase
        .from('products')
        .select('id, product_code')
        .in('product_code', uniqueCodes);
    const codeToUuid = new Map((productRows || []).map((r) => [r.product_code, r.id]));

    // Reject phantom codes. Otherwise we'd insert order_items with
    // product_id=null, which silently breaks the downstream JOIN that
    // resolves BOM / fabric / type for the operator boards and the
    // INSUMOS table in the PDF. (Order #6 hit this: a stale cart held
    // "ULPS-CS001" while the live product code was "ULPS-CH001",
    // and the resulting order showed no insumos for 30 pieces of
    // Chaleco Seguridad.)
    const missing = uniqueCodes.filter((c) => !codeToUuid.has(c));
    if (missing.length > 0) {
        await supabase.from('orders').delete().eq('id', order.id);
        throw new Error(
            `Productos no encontrados en el catálogo: ${missing.join(', ')}. ` +
                `Refrescá el catálogo y volvé a armar el pedido.`
        );
    }

    const itemRows = cart.map((item) => ({
        order_id: order.id,
        product_code: item.productId,
        product_name: item.productName,
        size: selectionToSizeString(item.selection),
        quantity: item.quantity,
        product_id: codeToUuid.get(item.productId) || null
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(itemRows);

    if (itemsError) {
        await supabase.from('orders').delete().eq('id', order.id);
        throw itemsError;
    }

    return {
        id: order.id,
        orderRef: formatOrderRef(order.order_number),
        orderNumber: order.order_number,
        createdAt: order.created_at
    };
};

// Read helpers --------------------------------------------------------------

const pickOne = <T>(value: T | T[] | null | undefined): T | null => {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
};

interface CompanyJoin {
    id: string;
    name: string;
    document_number: string | null;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
}

interface ItemProduct {
    product_type: 'shirt' | 'pant' | null;
    fabric_type: string | null;
    bom_json: { name: string; qty: number }[] | null;
    codigo_cabys: string | null;
    image_url: string | null;
    stages_json: string[] | null;
}

interface ItemJoin {
    id: string;
    product_code: string;
    product_name: string;
    size: string;
    quantity: number;
    description: string | null;
    is_extra: boolean | null;
    note: string | null;
    product: ItemProduct | ItemProduct[] | null;
}

interface RawOrderRow {
    id: string;
    order_number: number;
    status: string;
    estimated_delivery_date: string | null;
    notes: string | null;
    purchase_order: string | null;
    created_at: string;
    company: CompanyJoin | CompanyJoin[] | null;
    items: ItemJoin[] | null;
}

const NESTED_SELECT = `
    id,
    order_number,
    status,
    estimated_delivery_date,
    notes,
    purchase_order,
    created_at,
    company:companies ( id, name, document_number, contact_name, email, phone, address ),
    items:order_items (
        id,
        product_code,
        product_name,
        size,
        quantity,
        description,
        is_extra,
        note,
        product:products ( product_type, fabric_type, bom_json, codigo_cabys, image_url, stages_json )
    )
`;

const mapRowToOrder = (row: RawOrderRow): Order => {
    const company = pickOne(row.company);
    return {
        id: formatOrderRef(row.order_number),
        uuid: row.id,
        customerName: company?.contact_name || '',
        companyName: company?.name || '',
        companyDocument: company?.document_number || '',
        email: company?.email || '',
        phone: company?.phone || '',
        address: company?.address || '',
        purchaseOrder: row.purchase_order || '',
        deliveryDate: row.estimated_delivery_date || '',
        notes: row.notes || '',
        items: (row.items || []).map((it) => {
            const product = pickOne(it.product);
            return {
                uuid: it.id,
                productId: it.product_code,
                productName: it.product_name,
                selection: { size: it.size },
                quantity: it.quantity,
                productType: product?.product_type || undefined,
                // Extras carry their tela in `description` (no products
                // row to join), so fall back to it for the Tela column.
                fabricType:
                    product?.fabric_type ||
                    (it.is_extra ? it.description || undefined : undefined),
                bom: product?.bom_json || undefined,
                codigoCabys: product?.codigo_cabys || undefined,
                imageUrl: product?.image_url || undefined,
                isExtra: it.is_extra === true,
                note: it.note || undefined,
                stages: product?.stages_json || undefined
            };
        }),
        dateCreated: row.created_at,
        status: row.status
    };
};

/**
 * Recover product data (BOM, fabric, type, cabys, image) for order items
 * whose FK to `products` is null but whose `product_code` still matches
 * a live product. This happens when:
 *  - An older order was inserted with product_id=null (pre-validation
 *    days, e.g. order #6's "ULPS-CS001" → "ULPS-CH001" code drift).
 *  - A product was deleted and re-created with the same code.
 *
 * Without this fallback, the operator board shows zero insumos for the
 * order even when the BOM is configured on the matching product.
 */
const hydrateOrphanItems = async (
    supabase: SupabaseClient,
    orders: Order[]
): Promise<void> => {
    const orphanCodes = new Set<string>();
    for (const o of orders) {
        for (const i of o.items) {
            if (!i.bom && !i.productType && !i.fabricType && i.productId) {
                orphanCodes.add(i.productId);
            }
        }
    }
    if (orphanCodes.size === 0) return;

    const { data } = await supabase
        .from('products')
        .select('product_code, product_type, fabric_type, bom_json, codigo_cabys, image_url')
        .in('product_code', Array.from(orphanCodes));
    if (!data) return;

    const byCode = new Map(
        data.map((r) => [
            r.product_code,
            r as {
                product_code: string;
                product_type: 'shirt' | 'pant' | null;
                fabric_type: string | null;
                bom_json: { name: string; qty: number }[] | null;
                codigo_cabys: string | null;
                image_url: string | null;
            }
        ])
    );

    for (const o of orders) {
        for (const i of o.items) {
            if (i.bom || i.productType || i.fabricType) continue;
            const hit = byCode.get(i.productId);
            if (!hit) continue;
            i.productType = hit.product_type || undefined;
            i.fabricType = hit.fabric_type || undefined;
            i.bom = hit.bom_json || undefined;
            i.codigoCabys = hit.codigo_cabys || undefined;
            i.imageUrl = hit.image_url || undefined;
        }
    }
};

export const fetchUserOrders = async (
    supabase: SupabaseClient,
    userId: string
): Promise<Order[]> => {
    // A customer must see ALL of their company's orders, not only the
    // ones they personally created. Orders placed by the admin on the
    // company's behalf (the "place on behalf of" flow) have
    // created_by = admin, so a created_by-only filter hid them and the
    // customer's dashboard showed 0 orders. Resolve the company first,
    // then match company_id OR created_by (the latter covers a rare
    // user who has orders but no company link yet).
    const { data: link } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();
    const companyId = link?.company_id as string | undefined;

    let query = supabase.from('orders').select(NESTED_SELECT);
    query = companyId
        ? query.or(`company_id.eq.${companyId},created_by.eq.${userId}`)
        : query.eq('created_by', userId);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    const orders = ((data || []) as unknown as RawOrderRow[]).map(mapRowToOrder);
    await hydrateOrphanItems(supabase, orders);
    return orders;
};

export const fetchAllOrders = async (
    supabase: SupabaseClient
): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('orders')
        .select(NESTED_SELECT)
        .order('created_at', { ascending: false });

    if (error) throw error;
    const orders = ((data || []) as unknown as RawOrderRow[]).map(mapRowToOrder);
    await hydrateOrphanItems(supabase, orders);
    return orders;
};

/** All orders for one company, newest first. Used by the company detail page. */
export const fetchOrdersForCompany = async (
    supabase: SupabaseClient,
    companyId: string
): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('orders')
        .select(NESTED_SELECT)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    const orders = ((data || []) as unknown as RawOrderRow[]).map(mapRowToOrder);
    await hydrateOrphanItems(supabase, orders);
    return orders;
};

/**
 * Load a specific set of orders by uuid. Used by the station shell to
 * load only the orders assigned to the logged-in station user (the
 * id list comes from station_assignments).
 */
export const fetchOrdersByIds = async (
    supabase: SupabaseClient,
    orderIds: string[]
): Promise<Order[]> => {
    if (orderIds.length === 0) return [];
    const { data, error } = await supabase
        .from('orders')
        .select(NESTED_SELECT)
        .in('id', orderIds)
        .order('created_at', { ascending: false });
    if (error) throw error;
    const orders = ((data || []) as unknown as RawOrderRow[]).map(mapRowToOrder);
    await hydrateOrphanItems(supabase, orders);
    return orders;
};

export const updateOrderStatus = async (
    supabase: SupabaseClient,
    orderUuid: string,
    status: OrderStatus
): Promise<void> => {
    const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderUuid);
    if (error) throw error;
};

export interface ExtraItemInput {
    productName: string;
    size: string;
    quantity: number;
    fabricType?: string;
    note?: string;
}

/**
 * Insert an "extra" line item on an order — used by the corte board.
 * product_code is "EXTRA" (no products row), so the orphan-hydration
 * pass + INSUMOS aggregation simply skip it (no BOM). Returns the new
 * order_items.id.
 */
export const addExtraOrderItem = async (
    supabase: SupabaseClient,
    orderUuid: string,
    input: ExtraItemInput,
    addedBy: string | null
): Promise<string> => {
    const { data, error } = await supabase
        .from('order_items')
        .insert({
            order_id: orderUuid,
            product_code: 'EXTRA',
            product_name: input.productName.trim(),
            // The size column is NOT NULL; default to "—" when blank.
            size: input.size.trim() || '—',
            quantity: input.quantity,
            description: input.fabricType?.trim() || null,
            is_extra: true,
            note: input.note?.trim() || null,
            added_by: addedBy
        })
        .select('id')
        .single();
    if (error) throw error;
    return (data as { id: string }).id;
};

export const deleteOrder = async (
    supabase: SupabaseClient,
    orderUuid: string
): Promise<void> => {
    // Delegate to the RPC that snapshots the order into
    // deleted_orders_history and deletes it in one transaction. That
    // keeps the history complete even if a cascade partially fails,
    // and lets the browser client run the operation without needing
    // blanket delete privileges on orders (the RPC is SECURITY DEFINER
    // and only performs this one vetted operation). order_number is
    // sequence-generated, so the deleted number is naturally skipped
    // — no manual gap-filling.
    const { error } = await supabase.rpc('delete_order_with_history', {
        p_order_uuid: orderUuid
    });
    if (error) throw error;
};

export interface UpdateOrderHeaderInput {
    purchaseOrder?: string | null;
    deliveryDate?: string | null;
    notes?: string | null;
}

export interface OrderItemInput {
    // Existing rows have an id; new rows omit it.
    id?: string;
    productCode: string;
    productName: string;
    size: string;
    quantity: number;
    productUuid: string | null;
}

export const updateOrderFull = async (
    supabase: SupabaseClient,
    orderUuid: string,
    header: UpdateOrderHeaderInput,
    items: OrderItemInput[]
): Promise<void> => {
    if (items.length === 0) {
        throw new Error('La orden debe tener al menos un artículo.');
    }

    const { error: headerError } = await supabase
        .from('orders')
        .update({
            purchase_order: header.purchaseOrder ?? null,
            estimated_delivery_date: header.deliveryDate || null,
            notes: header.notes ?? null
        })
        .eq('id', orderUuid);
    if (headerError) throw headerError;

    // Reconcile items: rows in DB that aren't submitted get deleted,
    // rows with an id get updated, rows without an id get inserted.
    // Surgical updates avoid churning unchanged rows.
    const { data: existing, error: fetchError } = await supabase
        .from('order_items')
        .select('id')
        .eq('order_id', orderUuid);
    if (fetchError) throw fetchError;

    const existingIds = new Set((existing || []).map((r) => r.id as string));
    const submittedIds = new Set(
        items.filter((i) => i.id).map((i) => i.id as string)
    );
    const toDelete = [...existingIds].filter((id) => !submittedIds.has(id));

    if (toDelete.length > 0) {
        const { error: delError } = await supabase
            .from('order_items')
            .delete()
            .in('id', toDelete);
        if (delError) throw delError;
    }

    const toInsert = items
        .filter((i) => !i.id)
        .map((i) => ({
            order_id: orderUuid,
            product_code: i.productCode,
            product_name: i.productName,
            size: i.size,
            quantity: i.quantity,
            product_id: i.productUuid
        }));
    if (toInsert.length > 0) {
        const { error: insError } = await supabase
            .from('order_items')
            .insert(toInsert);
        if (insError) throw insError;
    }

    const toUpdate = items.filter((i) => i.id);
    for (const item of toUpdate) {
        const { error: updError } = await supabase
            .from('order_items')
            .update({
                product_code: item.productCode,
                product_name: item.productName,
                size: item.size,
                quantity: item.quantity,
                product_id: item.productUuid
            })
            .eq('id', item.id!);
        if (updError) throw updError;
    }
};
