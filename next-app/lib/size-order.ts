// Canonical shirt-size ordering. Anything not listed sorts after these
// (numeric pant waists, then unknowns). XXL/2XL etc. are treated as the
// same rank so mixed naming still orders correctly.
const SHIRT_SIZE_RANK: Record<string, number> = {
    XS: 0,
    S: 1,
    M: 2,
    L: 3,
    XL: 4,
    '2XL': 5,
    XXL: 5,
    '3XL': 6,
    XXXL: 6,
    '4XL': 7,
    XXXXL: 7,
    '5XL': 8,
    XXXXXL: 8,
    '6XL': 9
};

// Split a stored size label ("Hombre · L", "M · 2XL", "32") into its
// gender prefix and the size proper. Accepts full words and the legacy
// single letters; a label without a prefix comes back with gender null.
export const splitSizeLabel = (
    label: string
): { gender: 'Hombre' | 'Mujer' | null; size: string } => {
    const trimmed = label.trim();
    const m = trimmed.match(/^(hombre|mujer|[HM])\s*[·\-]\s*(.+)$/i);
    if (!m) return { gender: null, size: trimmed };
    return {
        gender: m[1].charAt(0).toLowerCase() === 'h' ? 'Hombre' : 'Mujer',
        size: m[2].trim()
    };
};

// Decompose a size label like "H · 2XL", "M · L", "32" or "32/30" into a
// sort key. Gender prefix (H before M before none) is the primary axis;
// within a gender, shirt sizes follow SHIRT_SIZE_RANK and pant waists
// sort numerically after all letter sizes.
const sizeSortKey = (label: string): [number, number, string] => {
    const { gender, size } = splitSizeLabel(label);
    const genderRank = gender === 'Hombre' ? 0 : gender === 'Mujer' ? 1 : 2;

    const upper = size.toUpperCase().replace(/\s+/g, '');
    const rank = SHIRT_SIZE_RANK[upper];
    if (rank !== undefined) return [genderRank, rank, label];

    const num = parseFloat(size);
    if (Number.isFinite(num)) return [genderRank, 1000 + num, label];

    return [genderRank, 9999, label];
};

export const compareSizeLabels = (a: string, b: string): number => {
    const ka = sizeSortKey(a);
    const kb = sizeSortKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return ka[2].localeCompare(kb[2]);
};
