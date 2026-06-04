import {
    ShoppingCart,
    ClipboardList,
    Package,
    Building2,
    Sticker,
    FileText,
    Boxes,
    Wallet,
    HardHat,
    Receipt,
    Scissors,
    Factory,
    Printer,
    Sparkles,
    PackageCheck,
    PenTool,
    type LucideIcon
} from 'lucide-react';

// Curated quick actions — task- and navigation-oriented shortcuts that
// help the admin move through the app fast. Distinct from ADMIN_MODULES
// (the full app-launcher list): these are the colorful tiles on the home
// page, and the admin pins any of them into the top bar. Plain module so
// both server and client can import it; icons are component references.
export interface AdminAction {
    /** Stable slug used as the cookie key for pinned actions. */
    id: string;
    label: string;
    href: string;
    Icon: LucideIcon;
    /** Highlighted orange tile (the headline "create" action). */
    primary?: boolean;
    /** Optional live badge (e.g. count of pending items). */
    badgeKey?: 'invoicesToPay';
}

export const ADMIN_ACTIONS: AdminAction[] = [
    { id: 'new-order', label: 'Nuevo pedido', href: '/catalog', Icon: ShoppingCart, primary: true },
    { id: 'orders', label: 'Ver pedidos', href: '/admin/orders', Icon: ClipboardList },
    { id: 'new-product', label: 'Nuevo producto', href: '/admin/products', Icon: Package },
    { id: 'new-company', label: 'Nueva empresa', href: '/admin/companies', Icon: Building2 },
    { id: 'new-logo', label: 'Nuevo logo', href: '/admin/logos', Icon: Sticker },
    { id: 'invoices-pay', label: 'Facturas a pagar', href: '/admin/station-invoices', Icon: FileText, badgeKey: 'invoicesToPay' },
    { id: 'stock', label: 'Stock', href: '/admin/stock', Icon: Boxes },
    { id: 'materials', label: 'Materiales', href: '/admin/materials', Icon: Package },
    { id: 'cuentas', label: 'Cuentas', href: '/admin/cuentas', Icon: Wallet },
    { id: 'stations', label: 'Estaciones', href: '/admin/station-users', Icon: HardHat },
    { id: 'facturacion', label: 'Facturación', href: '/admin/facturacion', Icon: Receipt },
    { id: 'bodega', label: 'Bodega', href: '/admin/operador', Icon: Package },
    { id: 'corte', label: 'Corte', href: '/admin/corte', Icon: Scissors },
    { id: 'maquila', label: 'Maquila', href: '/admin/maquila', Icon: Factory },
    { id: 'impresion', label: 'Impresión', href: '/admin/impresion', Icon: Printer },
    { id: 'bordado', label: 'Bordado', href: '/admin/bordado', Icon: Sparkles },
    { id: 'empaque', label: 'Empaque', href: '/admin/empaque', Icon: PackageCheck },
    { id: 'ploter', label: 'Ploter', href: '/admin/ploter', Icon: PenTool }
];

export const actionById = (id: string): AdminAction | undefined =>
    ADMIN_ACTIONS.find((a) => a.id === id);
