import type { Product } from '@/lib/types';
import type { CatalogItem } from '@/lib/services/catalog-items';

// A product the public fast-order picker can render — the same shape the
// FastOrderStudio consumes (a Product plus its DB uuid).
export type FastOrderProduct = Product & { uuid: string };

// Catálogo-default items are the quote configurator's products: gender-
// neutral and sizeless. The fast order needs a size step, and it's a
// review-only solicitud, so we supply standard buckets that admin
// confirms when converting the request into a real order.
const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const WAIST_SIZES = [28, 30, 32, 34, 36, 38, 40, 42];

/**
 * Adapt a Catálogo-default item (catalog_items) into the fast-order
 * product shape so the same catalog drives both /cotizar and /ordenar.
 * `code` becomes the productCode carried on the request — that's what the
 * admin conversion uses, so no real products.id link is required.
 */
export function catalogItemToFastOrderProduct(item: CatalogItem): FastOrderProduct {
    const type: Product['type'] = item.productType === 'pant' ? 'pant' : 'shirt';

    // Swatches, each attaching the per-color photo when the item has one.
    const colors = item.colorOptions.map((c) => {
        const img = item.images.find((im) => im.color === c.name);
        return img?.url
            ? { name: c.name, hex: c.hex, imageUrl: img.url }
            : { name: c.name, hex: c.hex };
    });

    return {
        uuid: item.id,
        id: item.code,
        name: item.name,
        type,
        typeLabel: item.category || '',
        image: item.imageUrl || item.images[0]?.url || '',
        description: item.description,
        category: 'Unisex',
        genders: ['unisex'],
        sizes:
            type === 'pant'
                ? { waist: WAIST_SIZES }
                : { men: SHIRT_SIZES, women: SHIRT_SIZES },
        colors
    };
}
