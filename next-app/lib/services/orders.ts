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
        ? (selection.gender === 'Men' ? 'H · ' : 'M · ')
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
    cart: CartItem[]
): Promise<CreateOrderResult> => {
    if (cart.length === 0) throw new Error('El carrito está vacío.');

    const companyId = await getCompanyIdForUser(supabase, userId);

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
}

interface ItemJoin {
    id: string;
    product_code: string;
    product_name: string;
    size: string;
    quantity: number;
    description: string | null;
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
        product:products ( product_type, fabric_type, bom_json )
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
                productId: it.product_code,
                productName: it.product_name,
                selection: { size: it.size },
                quantity: it.quantity,
                productType: product?.product_type || undefined,
                fabricType: product?.fabric_type || undefined,
                bom: product?.bom_json || undefined
            };
        }),
        dateCreated: row.created_at,
        status: row.status
    };
};

export const fetchUserOrders = async (
    supabase: SupabaseClient,
    userId: string
): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('orders')
        .select(NESTED_SELECT)
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return ((data || []) as unknown as RawOrderRow[]).map(mapRowToOrder);
};

export const fetchAllOrders = async (
    supabase: SupabaseClient
): Promise<Order[]> => {
    const { data, error } = await supabase
        .from('orders')
        .select(NESTED_SELECT)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return ((data || []) as unknown as RawOrderRow[]).map(mapRowToOrder);
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
