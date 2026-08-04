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
    /** Sub-section within 'principal' so the launcher can chunk its 14
     *  modules into scannable groups (≤4-ish each) instead of one wall.
     *  'operaciones' is already small and flat, so it needs no sub. */
    sub?: 'general' | 'catalogo' | 'clientes' | 'config';
}

/** Human labels + display order for the 'principal' sub-sections. */
export const PRINCIPAL_SUBGROUPS: { key: NonNullable<AdminModule['sub']>; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'catalogo', label: 'Catálogo' },
    { key: 'clientes', label: 'Clientes y finanzas' },
    { key: 'config', label: 'Configuración' }
];

export const ADMIN_MODULES: AdminModule[] = [
    { id: 'home', label: 'Inicio', href: '/admin/home', Icon: Home, group: 'principal', sub: 'general' },
    { id: 'orders', label: 'Pedidos', href: '/admin/orders', Icon: ClipboardList, group: 'principal', sub: 'general' },
    { id: 'stock', label: 'Stock', href: '/admin/stock', Icon: Boxes, group: 'principal', sub: 'general' },
    { id: 'materials', label: 'Materiales', href: '/admin/materials', Icon: Package, group: 'principal', sub: 'general' },
    { id: 'products', label: 'Productos', href: '/admin/products', Icon: Package, group: 'principal', sub: 'catalogo' },
    { id: 'catalogo-default', label: 'Catálogo default', href: '/admin/catalogo-default', Icon: Boxes, group: 'principal', sub: 'catalogo' },
    { id: 'cotizador', label: 'Cotizador', href: '/admin/cotizador', Icon: FileText, group: 'principal', sub: 'catalogo' },
    { id: 'logos', label: 'Logos', href: '/admin/logos', Icon: Sticker, group: 'principal', sub: 'catalogo' },
    { id: 'companies', label: 'Empresas', href: '/admin/companies', Icon: Building2, group: 'principal', sub: 'clientes' },
    { id: 'cuentas', label: 'Cuentas', href: '/admin/cuentas', Icon: Wallet, group: 'principal', sub: 'clientes' },
    { id: 'facturacion', label: 'Facturación', href: '/admin/facturacion', Icon: Receipt, group: 'principal', sub: 'clientes' },
    { id: 'station-invoices', label: 'Facturas a pagar', href: '/admin/station-invoices', Icon: FileText, group: 'principal', sub: 'clientes' },
    { id: 'station-users', label: 'Estaciones', href: '/admin/station-users', Icon: HardHat, group: 'principal', sub: 'config' },
    { id: '3d-models', label: 'Modelos 3D', href: '/admin/3d-models', Icon: Box, group: 'principal', sub: 'config' },
    { id: 'operador', label: 'Bodega', href: '/admin/operador', Icon: Package, group: 'operaciones' },
    { id: 'corte', label: 'Corte', href: '/admin/corte', Icon: Scissors, group: 'operaciones' },
    { id: 'maquila', label: 'Maquila', href: '/admin/maquila', Icon: Factory, group: 'operaciones' },
    { id: 'impresion', label: 'Impresión', href: '/admin/impresion', Icon: Printer, group: 'operaciones' },
    { id: 'bordado', label: 'Bordado', href: '/admin/bordado', Icon: Sparkles, group: 'operaciones' },
    { id: 'empaque', label: 'Empaque', href: '/admin/empaque', Icon: PackageCheck, group: 'operaciones' },
    { id: 'ploter', label: 'Ploter', href: '/admin/ploter', Icon: PenTool, group: 'operaciones' },
    { id: 'entregas', label: 'Entregas', href: '/admin/entregas', Icon: Truck, group: 'operaciones' }
];

/** Longest-prefix match of a pathname to a module, so the shell can show
 *  the current location. `/admin/orders/123` resolves to Pedidos. */
export function activeModule(pathname: string | null | undefined): AdminModule | undefined {
    if (!pathname) return undefined;
    let best: AdminModule | undefined;
    for (const m of ADMIN_MODULES) {
        if (pathname === m.href || pathname.startsWith(m.href + '/')) {
            if (!best || m.href.length > best.href.length) best = m;
        }
    }
    return best;
}
