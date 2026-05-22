import type { CartItem, Order } from '@/lib/types';

// Stage-board helpers shared across /admin/operador (bodega), /admin/corte,
// /admin/maquila, /admin/impresion. Extracted from operator-board so the
// new boards reuse the same aggregation logic and the same quantity
// rounding rules.

export interface InsumoSummary {
    name: string;
    totalQty: number;
}

export function roundQty(n: number): number {
    return Math.round(n * 100) / 100;
}

export function aggregateInsumos(items: CartItem[]): InsumoSummary[] {
    const map = new Map<string, number>();
    for (const item of items) {
        if (!item.bom) continue;
        for (const b of item.bom) {
            const key = b.name.trim().toLowerCase();
            map.set(key, (map.get(key) || 0) + b.qty * item.quantity);
        }
    }
    return Array.from(map.entries())
        .map(([name, totalQty]) => ({ name, totalQty: roundQty(totalQty) }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function aggregateInsumosGlobal(orders: Order[]): InsumoSummary[] {
    const allItems = orders.flatMap((o) => o.items);
    return aggregateInsumos(allItems);
}

// Heuristic color parser. Product naming convention in this app is
// roughly "<Product> <Color> de <Gender>" (e.g. "Columbia Azul de
// Hombre", "Docker Beige de Mujer"). When the convention isn't met we
// return undefined and callers fall back to the fabric type or "—".
const COLOR_WORDS = new Set([
    'azul',
    'rojo',
    'verde',
    'amarillo',
    'negro',
    'blanco',
    'gris',
    'beige',
    'café',
    'cafe',
    'rosa',
    'naranja',
    'morado',
    'celeste',
    'turquesa',
    'kaki',
    'caqui',
    'crema',
    'marino',
    'vino',
    'oliva',
    'mostaza',
    'coral',
    'salmón',
    'salmon',
    'menta',
    'lila',
    'violeta'
]);

export function parseColor(name: string | undefined | null): string | undefined {
    if (!name) return undefined;
    const tokens = name.toLowerCase().split(/[\s,\-/]+/);
    for (const t of tokens) {
        if (COLOR_WORDS.has(t)) {
            return t.charAt(0).toUpperCase() + t.slice(1);
        }
    }
    return undefined;
}

// Cut-list aggregation: groups items across all orders in the corte
// stage by (fabric, color, size), summing quantities. The result is
// what the cutting operator needs to see — how much of each fabric/
// color/size combination to lay out and cut.
export interface CutLine {
    fabric: string;
    color: string;
    size: string;
    totalQty: number;
    // Which orders contributed to this line (for traceability).
    orderRefs: string[];
}

export function aggregateCutLines(orders: Order[]): CutLine[] {
    const map = new Map<string, CutLine>();
    for (const order of orders) {
        for (const item of order.items) {
            const fabric = item.fabricType || '—';
            const color = parseColor(item.productName) || '—';
            const size = item.selection.size || '—';
            const key = `${fabric}__${color}__${size}`;
            const existing = map.get(key);
            if (existing) {
                existing.totalQty += item.quantity;
                if (!existing.orderRefs.includes(order.id)) {
                    existing.orderRefs.push(order.id);
                }
            } else {
                map.set(key, {
                    fabric,
                    color,
                    size,
                    totalQty: item.quantity,
                    orderRefs: [order.id]
                });
            }
        }
    }
    return Array.from(map.values()).sort((a, b) => {
        if (a.fabric !== b.fabric) return a.fabric.localeCompare(b.fabric);
        if (a.color !== b.color) return a.color.localeCompare(b.color);
        return a.size.localeCompare(b.size);
    });
}
