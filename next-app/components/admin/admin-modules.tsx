import {
    Home,
    ClipboardList,
    Boxes,
    Package,
    Wallet,
    Building2,
    Sticker,
    HardHat,
    FileText,
    Receipt,
    Scissors,
    Factory,
    Printer,
    Sparkles,
    PackageCheck,
    PenTool,
    Box,
    Truck,
    type LucideIcon
} from 'lucide-react';

// Single source of truth for the admin modules. Consumed by the app
// launcher, the configurable top-bar fast actions, and the fast-action
// config panel in the home module — so labels, hrefs and icons can't
// drift between them. Plain module (no 'use client' / 'server-only') so
// both server and client components can import it; icons are component
// references rendered at the call site.
export interface AdminModule {
    /** Stable slug — used as the cookie key for fast actions. No slashes
     *  or special chars so it survives a cookie value round-trip. */
    id: string;
    label: string;
    href: string;
    Icon: LucideIcon;
    group: 'principal' | 'operaciones';
}

export const ADMIN_MODULES: AdminModule[] = [
    { id: 'home', label: 'Inicio', href: '/admin/home', Icon: Home, group: 'principal' },
    { id: 'orders', label: 'Pedidos', href: '/admin/orders', Icon: ClipboardList, group: 'principal' },
    { id: 'stock', label: 'Stock', href: '/admin/stock', Icon: Boxes, group: 'principal' },
    { id: 'materials', label: 'Materiales', href: '/admin/materials', Icon: Package, group: 'principal' },
    { id: 'cuentas', label: 'Cuentas', href: '/admin/cuentas', Icon: Wallet, group: 'principal' },
    { id: 'companies', label: 'Empresas', href: '/admin/companies', Icon: Building2, group: 'principal' },
    { id: 'products', label: 'Productos', href: '/admin/products', Icon: Package, group: 'principal' },
    { id: 'catalogo-default', label: 'Catálogo default', href: '/admin/catalogo-default', Icon: Boxes, group: 'principal' },
    { id: 'cotizador', label: 'Cotizador', href: '/admin/cotizador', Icon: FileText, group: 'principal' },
    { id: 'logos', label: 'Logos', href: '/admin/logos', Icon: Sticker, group: 'principal' },
    { id: '3d-models', label: 'Modelos 3D', href: '/admin/3d-models', Icon: Box, group: 'principal' },
    { id: 'station-users', label: 'Estaciones', href: '/admin/station-users', Icon: HardHat, group: 'principal' },
    { id: 'station-invoices', label: 'Facturas a pagar', href: '/admin/station-invoices', Icon: FileText, group: 'principal' },
    { id: 'facturacion', label: 'Facturación', href: '/admin/facturacion', Icon: Receipt, group: 'principal' },
    { id: 'operador', label: 'Bodega', href: '/admin/operador', Icon: Package, group: 'operaciones' },
    { id: 'corte', label: 'Corte', href: '/admin/corte', Icon: Scissors, group: 'operaciones' },
    { id: 'maquila', label: 'Maquila', href: '/admin/maquila', Icon: Factory, group: 'operaciones' },
    { id: 'impresion', label: 'Impresión', href: '/admin/impresion', Icon: Printer, group: 'operaciones' },
    { id: 'bordado', label: 'Bordado', href: '/admin/bordado', Icon: Sparkles, group: 'operaciones' },
    { id: 'empaque', label: 'Empaque', href: '/admin/empaque', Icon: PackageCheck, group: 'operaciones' },
    { id: 'ploter', label: 'Ploter', href: '/admin/ploter', Icon: PenTool, group: 'operaciones' },
    { id: 'entregas', label: 'Entregas', href: '/admin/entregas', Icon: Truck, group: 'operaciones' }
];
