import type { Order } from '@/lib/types';
import type { AdminProduct } from '@/lib/services/products';
import type { Company } from '@/lib/services/companies';
import { productHasFabricRow } from '@/lib/corte-fabric';

// ─── Admin task inbox ────────────────────────────────────────────────
// Configuration gaps only show up when someone hits them mid-production:
// a product with no BOM prints "Sin insumos configurados" on the corte
// card, an empresa with no catálogo can't be ordered for at all, and a
// line detached from its product silently loses its insumos. Each was
// found by hand before; this turns them into a standing list on Inicio.
//
// Everything here is derived from data the home page already loads
// (orders, products, companies), so the section costs no extra queries.
// Pure and `now`-injectable so the windowing can be tested.

export type TaskKind =
    | 'product-no-bom'
    | 'product-no-fabric'
    | 'company-no-catalog'
    | 'order-detached';

export type TaskSeverity = 'high' | 'medium' | 'low';

export interface AdminTask {
    id: string;
    kind: TaskKind;
    /** What needs attention (product / empresa / pedido name). */
    title: string;
    /** Why it matters, in the admin's words. */
    detail: string;
    /** Where to go to fix it. */
    href: string;
    severity: TaskSeverity;
    /** Usage figure that justifies the priority, when there is one. */
    metric?: string;
    /** Drives ordering inside a group — higher is more urgent. */
    weight: number;
}

export interface TaskGroup {
    kind: TaskKind;
    title: string;
    /** One line explaining the consequence of leaving these unfixed. */
    blurb: string;
    href: string;
    tasks: AdminTask[];
}

const RECENT_DAYS = 90;

/** Pieces ordered per product code inside the recency window. */
function recentVolumeByCode(orders: Order[], now: Date): Map<string, number> {
    const cutoff = now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000;
    const out = new Map<string, number>();
    for (const o of orders) {
        if (o.status === 'cancelled') continue;
        const t = new Date(o.dateCreated).getTime();
        if (!Number.isFinite(t) || t < cutoff) continue;
        for (const it of o.items) {
            if (!it.productId) continue;
            out.set(it.productId, (out.get(it.productId) || 0) + it.quantity);
        }
    }
    return out;
}

const pieces = (n: number) => `${n} pza${n === 1 ? '' : 's'} · 90 d`;

export function buildAdminTasks({
    products,
    companies,
    orders,
    now = new Date()
}: {
    products: AdminProduct[];
    companies: Company[];
    orders: Order[];
    now?: Date;
}): TaskGroup[] {
    const volume = recentVolumeByCode(orders, now);
    const activeProducts = products.filter((p) => p.isActive);

    // ── Products with no BOM at all ──────────────────────────────────
    const noBom: AdminTask[] = [];
    // ── Products whose BOM can't yield a corte estimate ──────────────
    const noFabric: AdminTask[] = [];

    for (const p of activeProducts) {
        const used = volume.get(p.id) || 0;
        const bom = p.bom || [];
        if (bom.length === 0) {
            noBom.push({
                id: `nobom-${p.uuid}`,
                kind: 'product-no-bom',
                title: `${p.id} · ${p.name}`,
                detail: 'Sin insumos: las tarjetas de producción salen vacías.',
                href: '/admin/products',
                severity: used > 0 ? 'high' : 'medium',
                metric: used > 0 ? pieces(used) : 'sin pedidos recientes',
                weight: used
            });
            continue;
        }
        if (!productHasFabricRow(bom, p.fabricType)) {
            noFabric.push({
                id: `nofabric-${p.uuid}`,
                kind: 'product-no-fabric',
                title: `${p.id} · ${p.name}`,
                detail: p.fabricType
                    ? `Tela "${p.fabricType}" sin línea de consumo en el BOM.`
                    : 'Sin tela asignada, no hay consumo esperado.',
                href: '/admin/products',
                severity: used >= 100 ? 'high' : used > 0 ? 'medium' : 'low',
                metric: used > 0 ? pieces(used) : 'sin pedidos recientes',
                weight: used
            });
        }
    }

    // ── Empresas with an empty catálogo ──────────────────────────────
    // Nothing can be ordered for them: every ordering screen builds its
    // list from company_products, so the picker comes up empty.
    const assigned = new Set<string>();
    for (const p of activeProducts) {
        for (const cid of p.companyIds || []) assigned.add(cid);
    }
    const ordersByCompany = new Map<string, number>();
    for (const o of orders) {
        if (!o.companyName) continue;
        ordersByCompany.set(
            o.companyName,
            (ordersByCompany.get(o.companyName) || 0) + 1
        );
    }
    const noCatalog: AdminTask[] = companies
        .filter((c) => c.isActive && !assigned.has(c.id))
        .map((c) => {
            const past = ordersByCompany.get(c.name) || 0;
            return {
                id: `nocatalog-${c.id}`,
                kind: 'company-no-catalog',
                title: c.name,
                detail: 'Sin productos asignados: no se le puede crear pedidos.',
                href: `/admin/companies/${c.id}`,
                severity: past > 0 ? 'high' : 'medium',
                metric: past > 0 ? `${past} pedido${past === 1 ? '' : 's'} previo${past === 1 ? '' : 's'}` : 'sin pedidos',
                weight: past
            } satisfies AdminTask;
        });

    // ── Order lines detached from their product ──────────────────────
    // The line still prints, but the BOM join is broken so the order
    // shows no insumos. Extras legitimately have no product row.
    const knownCodes = new Set(products.map((p) => p.id));
    const detached: AdminTask[] = [];
    for (const o of orders) {
        if (o.status === 'cancelled') continue;
        const broken = o.items.filter(
            (i) => !i.isExtra && i.productId && !knownCodes.has(i.productId)
        );
        if (broken.length === 0) continue;
        const codes = [...new Set(broken.map((i) => i.productId))];
        detached.push({
            id: `detached-${o.uuid || o.id}`,
            kind: 'order-detached',
            title: `${o.id} · ${o.companyName}`,
            detail: `Código sin producto: ${codes.join(', ')}. El pedido no muestra insumos.`,
            href: '/admin/orders',
            severity: 'high',
            metric: `${broken.length} línea${broken.length === 1 ? '' : 's'}`,
            weight: 1000 + broken.length
        });
    }

    const byWeight = (a: AdminTask, b: AdminTask) =>
        b.weight - a.weight || a.title.localeCompare(b.title);

    const groups: TaskGroup[] = [
        {
            kind: 'order-detached',
            title: 'Pedidos sin producto vinculado',
            blurb: 'La línea perdió su producto: el pedido no muestra insumos.',
            href: '/admin/orders',
            tasks: detached.sort(byWeight)
        },
        {
            kind: 'company-no-catalog',
            title: 'Empresas sin catálogo',
            blurb: 'No se les puede crear pedidos hasta asignarles productos.',
            href: '/admin/companies',
            tasks: noCatalog.sort(byWeight)
        },
        {
            kind: 'product-no-bom',
            title: 'Productos sin insumos',
            blurb: 'Producción los ve como "Sin insumos configurados".',
            href: '/admin/products',
            tasks: noBom.sort(byWeight)
        },
        {
            kind: 'product-no-fabric',
            title: 'Productos sin consumo de tela',
            blurb: 'Corte no puede comparar lo gastado contra lo esperado.',
            href: '/admin/products',
            tasks: noFabric.sort(byWeight)
        }
    ];

    return groups.filter((g) => g.tasks.length > 0);
}

/** Total across groups — drives the header count and the empty state. */
export const countTasks = (groups: TaskGroup[]): number =>
    groups.reduce((s, g) => s + g.tasks.length, 0);

export const countBySeverity = (
    groups: TaskGroup[],
    severity: TaskSeverity
): number =>
    groups.reduce(
        (s, g) => s + g.tasks.filter((t) => t.severity === severity).length,
        0
    );
