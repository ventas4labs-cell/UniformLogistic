import type { CartItem, Order } from '@/lib/types';
import { extractSizeLabel, resolveBomQty } from '@/lib/services/products';
import { STAGE_ORDER, type StageKey } from '@/lib/services/stage-completions';

// Stage-board helpers shared across /admin/operador (bodega), /admin/corte,
// /admin/maquila, /admin/impresion. Extracted from operator-board so the
// new boards reuse the same aggregation logic and the same quantity
// rounding rules.

// ── Per-product stage applicability ─────────────────────────────────
// A product declares the stages it needs (products.stages_json). An
// empty/undefined list means "all stages" — back-compat for products
// created before the field existed, so they keep showing everywhere.

export function itemStages(item: CartItem): StageKey[] {
    const s = item.stages;
    return s && s.length > 0 ? (s as StageKey[]) : STAGE_ORDER;
}

/** Stages this order actually needs — the union across its items. */
export function orderApplicableStages(order: Order): StageKey[] {
    const set = new Set<StageKey>();
    for (const it of order.items) for (const s of itemStages(it)) set.add(s);
    return STAGE_ORDER.filter((s) => set.has(s));
}

/** True if any item in the order needs the given stage. */
export function orderNeedsStage(order: Order, stage: StageKey): boolean {
    return order.items.some((it) => itemStages(it).includes(stage));
}

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
        // Per-size BOM overrides (qtyBySize) let XXL+ pieces consume
        // more material than the base SKU. resolveBomQty falls back to
        // b.qty when no override matches the line's size.
        const sizeLabel = extractSizeLabel(item.selection.size);
        for (const b of item.bom) {
            const perUnit = resolveBomQty(b, sizeLabel);
            if (perUnit <= 0) continue;
            const key = b.name.trim().toLowerCase();
            map.set(key, (map.get(key) || 0) + perUnit * item.quantity);
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

// Shade modifiers that follow a color word ("azul oscuro", "verde
// claro"). Captured into the label so the swatch can be darkened /
// lightened and the cutter sees the exact shade.
const SHADE_WORDS = new Set(['claro', 'clara', 'oscuro', 'oscura']);

// Extract every color from a fabric/tela string. The tela convention
// here is "<fabric> <color> / <fabric> <color>" — e.g.
// "Army azul oscuro / Speed dry negro" → ["Azul oscuro", "Negro"].
// Each "/"-separated segment is scanned independently so a two-fabric
// garment surfaces both colors. Deduplicates while preserving order.
export function parseColors(fabric: string | undefined | null): string[] {
    if (!fabric) return [];
    const out: string[] = [];
    for (const segment of fabric.split('/')) {
        const tokens = segment.toLowerCase().split(/[\s,\-]+/).filter(Boolean);
        for (let i = 0; i < tokens.length; i++) {
            if (!COLOR_WORDS.has(tokens[i])) continue;
            let label = tokens[i].charAt(0).toUpperCase() + tokens[i].slice(1);
            const next = tokens[i + 1];
            if (next && SHADE_WORDS.has(next)) label += ' ' + next;
            if (!out.includes(label)) out.push(label);
        }
    }
    return out;
}
