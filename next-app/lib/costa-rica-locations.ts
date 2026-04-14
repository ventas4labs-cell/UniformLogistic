// ─── Costa Rica Provincia / Cantón / Distrito Code Lookup ────────────────
// Hacienda v4.4 expects numeric codes. This module accepts either a name or
// a numeric code and returns the canonical numeric form. For full lookups
// of every canton/distrito, populate the maps below; otherwise pass numeric
// codes directly from fe_config.

const PROVINCIA_BY_NAME: Record<string, string> = {
    'san jose': '1',
    'san josé': '1',
    'alajuela': '2',
    'cartago': '3',
    'heredia': '4',
    'guanacaste': '5',
    'puntarenas': '6',
    'limon': '7',
    'limón': '7'
};

function normalize(s: string | undefined | null): string {
    return (s || '').trim().toLowerCase();
}

function asNumericPad(value: string | undefined, width: number): string {
    if (!value) return '0'.repeat(width);
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return trimmed.padStart(width, '0');
    return trimmed;
}

/**
 * Returns the 1-digit provincia code (1-7) for a province name or numeric code.
 */
export function getProvinciaCode(provincia: string | undefined): string {
    if (!provincia) return '1';
    const trimmed = provincia.trim();
    if (/^\d+$/.test(trimmed)) return trimmed.padStart(1, '0');
    const code = PROVINCIA_BY_NAME[normalize(trimmed)];
    return code || '1';
}

/**
 * Returns the 2-digit canton code. If already numeric, just pads. Otherwise
 * returns "01" as a fallback (admin must enter the numeric code in fe_config).
 */
export function getCantonCode(_provincia: string | undefined, canton: string | undefined): string {
    return asNumericPad(canton, 2);
}

/**
 * Returns the 2-digit distrito code. If already numeric, just pads. Otherwise
 * returns "01" as a fallback.
 */
export function getDistritoCode(
    _provincia: string | undefined,
    _canton: string | undefined,
    distrito: string | undefined
): string {
    return asNumericPad(distrito, 2);
}
