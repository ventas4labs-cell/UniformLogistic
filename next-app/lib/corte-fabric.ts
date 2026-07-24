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
