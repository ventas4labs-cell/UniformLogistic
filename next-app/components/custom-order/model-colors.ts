// Shared garment color palette for the 3D custom-order flow. The studio
// lets the customer pick one of these by name; design requests persist
// only the color *name*, so the admin's 3D inspector resolves the hex
// back through this same map. Keep in sync with the studio's COLORS.
export const MODEL_COLORS: { name: string; hex: string }[] = [
    { name: 'Beige', hex: '#d4b896' },
    { name: 'Blanco', hex: '#f5f5f0' },
    { name: 'Gris', hex: '#9aa1a9' },
    { name: 'Azul marino', hex: '#26324f' },
    { name: 'Celeste', hex: '#7fa8c9' },
    { name: 'Verde', hex: '#3f6f4f' },
    { name: 'Negro', hex: '#1c1c1e' }
];

// Resolve a color name to its hex, tolerating case/whitespace. Falls
// back to a neutral light gray so the model always renders.
export function colorHexByName(name: string | null | undefined): string {
    if (!name) return '#c9ccd1';
    const want = name.trim().toLowerCase();
    return MODEL_COLORS.find((c) => c.name.toLowerCase() === want)?.hex ?? '#c9ccd1';
}
