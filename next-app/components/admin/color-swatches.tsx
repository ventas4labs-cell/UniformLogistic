// ─── Fabric colour swatches ──────────────────────────────────────────
// Shared so any production board can render a tela's colour(s) the same
// way. Pure/presentational — safe to import from server or client trees.

// Base color hex by Spanish color name (lowercase keys). Falls back to
// a neutral gray for unrecognized names.
const COLOR_HEX: Record<string, string> = {
    azul: '#2563eb',
    rojo: '#dc2626',
    verde: '#16a34a',
    amarillo: '#facc15',
    negro: '#000000',
    blanco: '#ffffff',
    gris: '#9ca3af',
    beige: '#d4b896',
    café: '#7c4a1e',
    cafe: '#7c4a1e',
    rosa: '#f472b6',
    naranja: '#f97316',
    morado: '#9333ea',
    celeste: '#7dd3fc',
    turquesa: '#14b8a6',
    kaki: '#8a8456',
    caqui: '#8a8456',
    crema: '#fef3c7',
    marino: '#1e3a8a',
    vino: '#7f1d1d',
    oliva: '#65a30d',
    mostaza: '#ca8a04',
    coral: '#fb7185',
    menta: '#6ee7b7',
    lila: '#c084fc',
    violeta: '#7c3aed'
};

// Darken (amount < 0) or lighten (amount > 0) a #rrggbb hex.
function shadeHex(hex: string, amount: number): string {
    const m = hex.replace('#', '');
    if (m.length !== 6) return hex;
    const num = parseInt(m, 16);
    const adj = (c: number) =>
        amount < 0
            ? Math.round(c * (1 + amount))
            : Math.round(c + (255 - c) * amount);
    const r = adj((num >> 16) & 0xff);
    const g = adj((num >> 8) & 0xff);
    const b = adj(num & 0xff);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Heuristic color swatch. Accepts labels like "Azul oscuro" / "Negro";
// picks the base color word and applies a claro/oscuro shade. Falls
// back to neutral gray when no color word is recognized.
export function colorSwatch(label: string): string {
    const parts = label.toLowerCase().split(/\s+/);
    const base = parts.find((p) => COLOR_HEX[p]);
    let hex = base ? COLOR_HEX[base] : '#d1d5db';
    if (parts.some((p) => p.startsWith('oscur'))) hex = shadeHex(hex, -0.35);
    else if (parts.some((p) => p.startsWith('clar'))) hex = shadeHex(hex, 0.35);
    return hex;
}

// Renders one swatch + label per color. Telas with two fabric segments
// (e.g. "Army azul oscuro / Speed dry negro") surface both colors.
// `compact` drops the text label, leaving just the dots — for dense rows
// where the tela name already names the colour.
export function ColorSwatches({
    colors,
    compact = false
}: {
    colors: string[];
    compact?: boolean;
}) {
    if (colors.length === 0) {
        return <span className="text-gray-400 dark:text-zinc-500">—</span>;
    }
    return (
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            {colors.map((c, i) => (
                <span key={`${c}-${i}`} className="inline-flex items-center gap-1.5">
                    <span
                        className="w-3 h-3 rounded-full border border-gray-300 dark:border-zinc-600 shrink-0"
                        style={{ backgroundColor: colorSwatch(c) }}
                        title={c}
                    />
                    {!compact && (
                        <span className="text-gray-700 dark:text-zinc-300 whitespace-nowrap">
                            {c}
                        </span>
                    )}
                </span>
            ))}
        </span>
    );
}
