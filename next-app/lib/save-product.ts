import type { ProductInput } from '@/lib/services/products';
import type { SaveProductResult } from '@/app/(admin)/admin/products/actions';

// Use a stable URL: Server Action IDs can change while this form stays
// open across a deployment. Never retry a POST automatically, since a
// lost response does not mean the product wasn't saved.
export async function saveProduct(
    input: ProductInput,
    uuid?: string
): Promise<SaveProductResult> {
    const response = await fetch('/api/admin/products/save', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, uuid })
    });
    const result = await response.json().catch(() => null);
    if (result?.ok === false && typeof result.error === 'string') {
        return { ok: false, error: result.error };
    }
    if (!response.ok || result?.ok !== true) {
        return { ok: false, error: 'No se pudo guardar el producto. Intentá de nuevo.' };
    }
    return { ok: true };
}
