export type ProductType = 'shirt' | 'pant';
export type Gender = 'Men' | 'Women';

export interface Product {
    id: string;
    name: string;
    /**
     * Size-shape hint. Drives the size UI (men/women lists for shirts,
     * waist/inseam for pants) and the PDF section split. Stored as the
     * tight enum on the DB; the human-readable label lives in
     * `typeLabel`.
     */
    type: ProductType;
    /**
     * Free-text product category shown in admin lists, the catalog
     * card, and PDF section headers. Lets admin name things "Chaleco",
     * "Gorra", "Polo", etc. without changing the underlying size-shape.
     * Falls back to "Camisa" / "Pantalón" derived from `type` when
     * empty (legacy rows).
     */
    typeLabel: string;
    image: string;
    description: string;
    category: 'Men' | 'Women' | 'Unisex';
    sizes: {
        men?: string[];
        women?: string[];
        waist?: number[];
        inseam?: number[];
    };
}

export interface SizeSelection {
    gender?: Gender;
    waist?: number;
    inseam?: number;
    size?: string;
}

export interface CartItem {
    productId: string;
    productName: string;
    selection: SizeSelection;
    quantity: number;
    productType?: ProductType;
    fabricType?: string;
    bom?: { name: string; qty: number }[];
    codigoCabys?: string;
    imageUrl?: string;
    /**
     * order_items.id — only populated for items that came back from
     * the DB (Order rows). Customer-side cart items don't have an id
     * yet because the order hasn't been persisted.
     */
    uuid?: string;
}

export interface Order {
    id: string;
    uuid?: string;
    customerName: string;
    companyName: string;
    companyDocument?: string;
    email: string;
    phone: string;
    address?: string;
    purchaseOrder?: string;
    deliveryDate: string;
    notes: string;
    items: CartItem[];
    dateCreated: string;
    status?: string;
}

export interface CustomerForm {
    name: string;
    company: string;
    email: string;
    phone: string;
    notes: string;
    date: string;
    purchaseOrder: string;
}
