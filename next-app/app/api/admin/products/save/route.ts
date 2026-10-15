import {
    createProductAction,
    updateProductAction
} from '@/app/(admin)/admin/products/actions';
import type { ProductInput } from '@/lib/services/products';

const failure = (error: string, status: number) =>
    Response.json({ ok: false, error }, { status });

// The URL survives deployments; the existing actions still enforce admin
// authorization, format database errors, and revalidate the catalog.
export async function POST(request: Request) {
    // Route Handlers don't inherit Server Actions' Origin check. Match it
    // here and require JSON so cross-site HTML forms cannot submit saves.
    const origin = request.headers.get('origin');
    const host = request.headers.get('x-forwarded-host')
        ?? request.headers.get('host')
        ?? new URL(request.url).host;
    if (origin) {
        try {
            if (new URL(origin).host !== host) {
                return failure('No autorizado.', 403);
            }
        } catch {
            return failure('No autorizado.', 403);
        }
    }
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
        return failure('Se esperaba un producto en formato JSON.', 415);
    }

    let body: { input?: ProductInput; uuid?: string } | null;
    try {
        body = await request.json();
    } catch {
        return failure('JSON inválido.', 400);
    }
    const input = body?.input;
    if (!input || typeof input !== 'object'
        || typeof input.productCode !== 'string' || !input.productCode.trim()
        || typeof input.name !== 'string' || !input.name.trim()
        || !['shirt', 'pant'].includes(input.productType)
        || !input.sizes || typeof input.sizes !== 'object' || Array.isArray(input.sizes)
        || (body?.uuid !== undefined && (
            typeof body.uuid !== 'string'
            || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.uuid)
        ))) {
        return failure('Datos del producto inválidos.', 400);
    }

    try {
        const result = body?.uuid
            ? await updateProductAction(body.uuid, input)
            : await createProductAction(input);
        return Response.json(result, { status: result.ok ? 200 : 400 });
    } catch (error) {
        if (error instanceof Error && error.message === 'No autorizado.') {
            return failure('No autorizado.', 403);
        }
        console.error('Error al guardar el producto:', error);
        return failure('No se pudo guardar el producto.', 500);
    }
}
