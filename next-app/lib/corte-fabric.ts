import type { CartItem, Order } from '@/lib/types';
import { extractSizeLabel, resolveBomQty } from '@/lib/services/products';
import { COLOR_WORDS, roundQty } from '@/lib/stage-utils';

// ─── Corte fabric consumption ────────────────────────────────────────
// The corte agent reports how much tela each order actually ate. We
// group the order's pieces by tela (products.fabric_type) and, for each
// group, estimate from the product BOM what it *should* have taken so
// the board can show real vs. esperado and the difference.
//
// Deriving "expected" is best-effort: a BOM is a flat list of insumos
// with no explicit "this row is the fabric" flag, so we identify fabric
// rows heuristically (see isFabricBomLine). When nothing matches we
// return null rather than guessing — the operator still records the
// real figure, we just don't show a comparison.

/** Units the report offers. Metros is the house default. */
export const FABRIC_UNITS = ['m', 'yd', 'kg'] as const;

export const DEFAULT_FABRIC_UNIT = 'm';

/** Label shown for pieces whose product has no fabric_type set. */
export const UNSPECIFIED_FABRIC_LABEL = 'Sin tela especificada';

export interface FabricLine {
    /** Tela as written on the order lines; '' = sin especificar. */
    fabricType: string;
    /** What to print for this group. */
    label: string;
    /** Pieces cut from this tela. */
    pieces: number;
    /** BOM estimate for the whole group, or null when not derivable. */
    expectedQty: number | null;
    /** Unit the estimate is in (and the input's default). */
    unit: string;
}

// Strip accents + lowercase so "Café" and "cafe" compare equal.
const norm = (s: string) =>
    s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();

const tokenize = (s: string) =>
    norm(s)
        .split(/[^a-z0-9]+/)
        .filter(Boolean);

// Words that say nothing about *which* fabric a row is, so they must
// never be what makes a BOM row match a tela. Colours are the dangerous
// ones: "Velcro negro" would otherwise match the tela "Speed dry negro".
const GENERIC_TOKENS = new Set([
    'tela',
    'telas',
    'para',
    'color',
    'oscuro',
    'oscura',
    'claro',
    'clara',
    'talla',
    'hombre',
    'mujer'
]);

const isMeaningful = (t: string) =>
    t.length >= 4 && !GENERIC_TOKENS.has(t) && !COLOR_WORDS.has(t);

/**
 * Is this BOM row the fabric for a piece cut from `fabricType`?
 *
 * Two signals, both name-based. Unit is deliberately NOT a signal —
 * real data has velcro and elástico measured in m/cm too, so it would
 * pull haberdashery into the fabric total.
 */
function isFabricBomLine(bomName: string, fabricType: string): boolean {
    const tokens = tokenize(bomName);
    // "Tela ripstop negro", "Tela malla blanca". Note "Entretela" is a
    // single token and correctly does NOT match — interlining is not
    // the fabric being cut.
    if (tokens.some((t) => t === 'tela' || t === 'telas')) return true;
    // Fabrics named by brand rather than prefixed: BOM "Cordura Beige"
    // against tela "Cordura beige".
    if (!fabricType) return false;
    const want = new Set(tokenize(fabricType).filter(isMeaningful));
    if (want.size === 0) return false;
    return tokens.some((t) => want.has(t));
}

/**
 * Expected fabric for one line: sum of its fabric BOM rows × quantity.
 * Returns null when the product declares no identifiable fabric row.
 */
function expectedForItem(
    item: CartItem
): { qty: number; unit: string } | null {
    if (!item.bom || item.bom.length === 0) return null;
    const sizeLabel = extractSizeLabel(item.selection.size);
    let total = 0;
    let unit: string | null = null;
    let matched = false;
    for (const b of item.bom) {
        if (!isFabricBomLine(b.name, item.fabricType || '')) continue;
        const perUnit = resolveBomQty(b, sizeLabel);
        if (perUnit <= 0) continue;
        matched = true;
        total += perUnit * item.quantity;
        // First declared unit wins; BOM rows often leave it blank.
        if (!unit && b.unit) unit = b.unit;
    }
    if (!matched) return null;
    return { qty: total, unit: unit || DEFAULT_FABRIC_UNIT };
}

/**
 * Group an order's pieces by tela, with a BOM estimate per group.
 * This is what the corte report renders one input row for.
 */
export function fabricLinesForOrder(order: Order): FabricLine[] {
    const groups = new Map<
        string,
        { pieces: number; expected: number; hasExpected: boolean; unit: string }
    >();
    for (const item of order.items) {
        const key = (item.fabricType || '').trim();
        const g = groups.get(key) || {
            pieces: 0,
            expected: 0,
            hasExpected: false,
            unit: DEFAULT_FABRIC_UNIT
        };
        g.pieces += item.quantity;
        const est = expectedForItem(item);
        if (est) {
            g.hasExpected = true;
            g.expected += est.qty;
            g.unit = est.unit;
        }
        groups.set(key, g);
    }
    return Array.from(groups.entries())
        .map(([fabricType, g]) => ({
            fabricType,
            label: fabricType || UNSPECIFIED_FABRIC_LABEL,
            pieces: g.pieces,
            expectedQty: g.hasExpected ? roundQty(g.expected) : null,
            unit: g.unit
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

// ─── Consolidated consumption (Pedidos → Consumo de tela) ────────────
// Aggregation for the cross-order view. Pure and `now`-injectable so
// the period boundaries can be exercised deterministically.

export type FabricPeriod = 'month' | 'last-month' | '3m' | 'all';

/** One reported tela on one order, flattened for aggregation. */
export interface FabricUsageLine {
    orderRef: string;
    orderUuid: string;
    company: string;
    reportedAt: string;
    fabricType: string;
    label: string;
    used: number;
    unit: string;
    expected: number | null;
    notes: string | null;
}

export interface FabricUsageGroup {
    key: string;
    label: string;
    unit: string;
    used: number;
    /** Null when no line in the group had a derivable BOM estimate. */
    expected: number | null;
    orders: number;
    lines: FabricUsageLine[];
}

/** Inclusive-start / exclusive-end window, or null for "all time". */
export function fabricPeriodRange(
    period: FabricPeriod,
    now: Date = new Date()
): { from: Date; to: Date } | null {
    if (period === 'all') return null;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    if (period === 'month') return { from: startOfMonth, to: startOfNextMonth };
    if (period === 'last-month') {
        return {
            from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            to: startOfMonth
        };
    }
    return {
        from: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        to: startOfNextMonth
    };
}

/**
 * Filter by when corte reported the cut — that's when the tela was
 * actually consumed, not when the order was placed.
 */
export function filterFabricLines(
    lines: FabricUsageLine[],
    period: FabricPeriod,
    now: Date = new Date()
): FabricUsageLine[] {
    const range = fabricPeriodRange(period, now);
    if (!range) return lines;
    return lines.filter((l) => {
        const t = new Date(l.reportedAt);
        return t >= range.from && t < range.to;
    });
}

/**
 * Total per tela AND unit. The unit is part of the key on purpose:
 * metros and kilos must never land in the same total, and an estimate
 * in one unit says nothing about a figure in the other.
 */
export function groupFabricLines(lines: FabricUsageLine[]): FabricUsageGroup[] {
    const m = new Map<string, FabricUsageGroup>();
    for (const l of lines) {
        const key = `${l.label}|${l.unit}`;
        const g = m.get(key) || {
            key,
            label: l.label,
            unit: l.unit,
            used: 0,
            expected: null,
            orders: 0,
            lines: []
        };
        g.used = roundQty(g.used + l.used);
        // Stays null until at least one line carries an estimate, so a
        // group with no BOM coverage shows "—" rather than a fake 0.
        if (l.expected !== null) g.expected = roundQty((g.expected ?? 0) + l.expected);
        g.lines.push(l);
        m.set(key, g);
    }
    for (const g of m.values()) {
        g.orders = new Set(g.lines.map((l) => l.orderUuid)).size;
        g.lines.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
    }
    return Array.from(m.values()).sort((a, b) => b.used - a.used);
}
