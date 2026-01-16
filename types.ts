export type ProductType = 'shirt' | 'pant';
export type Gender = 'Men' | 'Women';

// Aspect ratios for Image Gen
export type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9' | '21:9';

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  image: string; // URL placeholder
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
  gender?: Gender; // For shirts
  waist?: number; // For pants
  inseam?: number; // For pants
  size?: string; // Standard S/M/L
}

export interface CartItem {
  productId: string;
  productName: string;
  selection: SizeSelection;
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  companyName: string;
  email: string;
  phone: string;
  deliveryDate: string;
  notes: string;
  items: CartItem[];
  dateCreated: string;
  status?: string; // e.g. 'new', 'in_progress', 'completed'
  aiCountId?: string; // Link to an AI count if applicable
}

export interface AICountResult {
  id: string;
  imageUrl: string;
  totalCount: number;
  breakdown: {
    shirts: number;
    pants: number;
    other: number;
  };
  confidence: number; // 0-100
  notes: string;
}

export enum AppView {
  LANDING = 'LANDING',
  CATALOG = 'CATALOG',
  PRODUCT_DETAIL = 'PRODUCT_DETAIL',
  CART = 'CART',
  CHECKOUT = 'CHECKOUT',
  SUCCESS = 'SUCCESS',
  LOGIN = 'LOGIN',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  AI_COUNT = 'AI_COUNT',
  AI_GENERATE = 'AI_GENERATE',
  ORDER_HISTORY = 'ORDER_HISTORY', // Added for history view
}