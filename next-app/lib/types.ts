export type ProductType = 'shirt' | 'pant';
export type Gender = 'Men' | 'Women';

export interface Product {
    id: string;
    name: string;
    type: ProductType;
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
