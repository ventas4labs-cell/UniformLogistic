export const NO_SIZE = 'No Size';

export type StockGender = 'men' | 'women' | null;

export function splitStockSize(value: string): { gender: StockGender; size: string } {
    if (value.startsWith('Hombre · ')) return { gender: 'men', size: value.slice(9) };
    if (value.startsWith('Mujer · ')) return { gender: 'women', size: value.slice(8) };
    return { gender: null, size: value };
}

interface StockSizeProduct {
    product_type: 'shirt' | 'pant';
    sizes_json: {
        men?: string[];
        women?: string[];
        waist?: number[];
        inseam?: number[];
    } | null;
}

/** Stock accepts every configured size, plus XS, with either gender or neither. */
export function stockProductSizes(product: StockSizeProduct): string[] {
    const configured = product.sizes_json || {};
    const labels = new Set(['XS', ...(configured.men || []), ...(configured.women || [])]);

    if (product.product_type === 'pant') {
        for (const waist of configured.waist || []) {
            if (configured.inseam?.length) {
                for (const inseam of configured.inseam) labels.add(`C${waist}" / L${inseam}"`);
            } else {
                labels.add(`C${waist}"`);
            }
        }
    }

    return withStockGenders(Array.from(labels));
}

function withStockGenders(labels: string[]): string[] {
    const sizes = new Set(labels);
    for (const label of labels) {
        sizes.add(`Hombre · ${label}`);
        sizes.add(`Mujer · ${label}`);
    }
    return Array.from(sizes);
}

/** Manual entries may also omit size while keeping existing SKU labels. */
export function manualStockSizes(configuredSizes: string[]): string[] {
    return Array.from(new Set([...withStockGenders([NO_SIZE]), ...configuredSizes]));
}
