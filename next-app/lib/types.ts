export type ProductType = 'shirt' | 'pant';
export type Gender = 'Men' | 'Women';

// Audience a product targets. A product can carry several of these.
export type ProductGender = 'men' | 'women' | 'unisex';

// Per-audience picture galleries. A product may hold multiple pictures
// for its men and women (and unisex) variants.
export interface ProductImages {
    men?: string[];
    women?: string[];
    unisex?: string[];
}

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
    // Primary/legacy audience, derived from `genders[0]`. Kept so older
    // readers (catalog cards, PDF section headers) keep working.
    category: 'Men' | 'Women' | 'Unisex';
    // Full audience set the product targets (Hombre / Mujer / Unisex).
    genders?: ProductGender[];
    // Per-audience picture galleries (multiple pictures per variant).
    // `image` remains the primary thumbnail.
    images?: ProductImages;
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
    /**
     * Product BOM, snapshotted from products.bom_json. Generic insumo
     * rows carry name/qty (+ optional per-size overrides); rows that
     * represent a logo also carry the logo linkage fields so the
     * production boards can render logos per product without a join.
     * Mirrors BomItem in services/products.ts (inlined to keep this
     * module dependency-free).
     */
    bom?: {
        name: string;
        qty: number;
        unit?: string;
        qtyBySize?: Record<string, number>;
        logoId?: string;
        logoImageUrl?: string;
        logoCategory?: 'bordado' | 'impresion';
        logoPlacement?: string;
    }[];
    codigoCabys?: string;
    imageUrl?: string;
    /**
     * order_items.id — only populated for items that came back from
     * the DB (Order rows). Customer-side cart items don't have an id
     * yet because the order hasn't been persisted.
     */
    uuid?: string;
    /**
     * True when the line was added at the corte stage as an "extra"
     * (replacement / sample / forgotten size) rather than placed in
     * the original order.
     */
    isExtra?: boolean;
    /** Optional free-text reason for an extra ("muestra", "rep. talla M"). */
    note?: string;
    /**
     * Production stages the item's product needs (from products.stages_json).
     * Empty/undefined means "all stages". Drives which stage boards an
     * order surfaces on. String keys to keep this type dependency-free.
     */
    stages?: string[];
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
