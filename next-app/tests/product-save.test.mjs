import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { beforeEach } from 'node:test';

// Exercise the real route and Server Actions with isolated auth/database
// boundaries. No live catalog data is created by this regression suite.
const mockModules = {
    'next/cache': `export const revalidatePath = (path) => globalThis.productSaveTest.revalidated.push(path);`,
    'next/headers': `export const cookies = () => { throw new Error('Unexpected cookie access'); };`,
    '@/utils/supabase/server': `export const createClient = async () => ({
        auth: { getUser: async () => ({ data: { user: globalThis.productSaveTest.user } }) }
    });`,
    '@/lib/services/products': `
        const write = (kind, input, uuid) => {
            const state = globalThis.productSaveTest;
            if (state.databaseError) throw state.databaseError;
            state.writes.push({ kind, input, uuid });
        };
        export const createProduct = async (_client, input) => write('create', input);
        export const updateProduct = async (_client, uuid, input) => write('update', input, uuid);
        export const deleteProduct = async () => { throw new Error('Unexpected delete'); };
        export const uploadProductImage = async () => { throw new Error('Unexpected upload'); };
    `
};

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (mockModules[specifier]) {
            return { url: `data:text/javascript,${encodeURIComponent(mockModules[specifier])}`, shortCircuit: true };
        }
        if (specifier.startsWith('@/')) {
            return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
        }
        return nextResolve(specifier, context);
    }
});

const { POST } = await import('../app/api/admin/products/save/route.ts');
const { saveProduct } = await import('../lib/save-product.ts');
const input = {
    productCode: 'TEST-1000', name: 'Chaleco', description: 'Reflectivo',
    imageUrl: '', productType: 'shirt', typeLabel: 'Chaleco', genders: ['unisex'],
    images: { unisex: ['https://example.com/chaleco.jpg'] },
    sizes: { men: ['XS', 'XL'], women: ['S'] },
    colors: [{ name: 'Naranja', hex: '#ff8000' }], skipsFabric: true,
    companyIds: ['12345678-1234-1234-1234-123456789012'],
    bom: [{ name: 'Logo', qty: 1, qtyBySize: { XL: 2 } }], stages: ['empaque']
};
const uuid = '98765432-1234-1234-1234-123456789012';

beforeEach(() => {
    globalThis.productSaveTest = {
        user: { email: 'ulogisticcr@gmail.com' }, writes: [], revalidated: [], databaseError: null
    };
});

const request = (body, headers = {}) => new Request('https://uniform.example/api/admin/products/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://uniform.example', ...headers },
    body: JSON.stringify(body)
});

test('an open form saves through a stable URL without a build-specific action ID', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(url, '/api/admin/products/save');
        assert.equal(options.method, 'POST');
        assert.equal(options.credentials, 'same-origin');
        assert.equal(new Headers(options.headers).has('next-action'), false);
        return POST(new Request(`https://uniform.example${url}`, options));
    });
    assert.deepEqual(await saveProduct(input), { ok: true });
    assert.deepEqual(globalThis.productSaveTest.writes, [{ kind: 'create', input, uuid: undefined }]);
    assert.deepEqual(globalThis.productSaveTest.revalidated, ['/admin/products']);
});

test('editing uses the same endpoint and updates the selected product', async (t) => {
    t.mock.method(globalThis, 'fetch', (url, options) => POST(new Request(`https://uniform.example${url}`, options)));
    assert.deepEqual(await saveProduct(input, uuid), { ok: true });
    assert.deepEqual(globalThis.productSaveTest.writes, [{ kind: 'update', input, uuid }]);
});

test('anonymous users and customers cannot create or update products', async () => {
    for (const user of [null, { email: 'customer@example.com' }]) {
        globalThis.productSaveTest.user = user;
        for (const id of [undefined, uuid]) {
            const response = await POST(request({ input, uuid: id }));
            assert.equal(response.status, 403);
            assert.deepEqual(await response.json(), { ok: false, error: 'No autorizado.' });
        }
    }
    assert.equal(globalThis.productSaveTest.writes.length, 0);
});

test('cross-site and non-JSON requests cannot mutate the catalog', async () => {
    for (const origin of ['https://attacker.example', 'null']) {
        assert.equal((await POST(request({ input }, { Origin: origin }))).status, 403);
    }
    assert.equal((await POST(request({ input }, { 'Content-Type': 'text/plain' }))).status, 415);
    assert.equal(globalThis.productSaveTest.writes.length, 0);
});

test('invalid JSON, missing fields and invalid update IDs fail before a write', async () => {
    const malformed = new Request('https://uniform.example/api/admin/products/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{'
    });
    assert.equal((await POST(malformed)).status, 400);
    for (const body of [null, {}, { input: {} }, { input: { ...input, name: ' ' } },
        { input: { ...input, sizes: [] } }, { input, uuid: '' }, { input, uuid: 'bad-id' }]) {
        assert.equal((await POST(request(body))).status, 400);
    }
    assert.equal(globalThis.productSaveTest.writes.length, 0);
});

test('duplicate product codes keep the existing friendly error and do not revalidate', async (t) => {
    globalThis.productSaveTest.databaseError = { code: '23505', message: 'duplicate key' };
    t.mock.method(globalThis, 'fetch', (url, options) => POST(new Request(`https://uniform.example${url}`, options)));
    assert.deepEqual(await saveProduct(input), {
        ok: false, error: 'Ya existe un producto con el código "TEST-1000". Usá un código distinto.'
    });
    assert.equal(globalThis.productSaveTest.revalidated.length, 0);
});

test('a lost response is not automatically retried, preventing duplicate creation', async (t) => {
    let attempts = 0;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        attempts++;
        await POST(new Request(`https://uniform.example${url}`, options));
        throw new TypeError('Failed to fetch');
    });
    await assert.rejects(saveProduct(input), /Failed to fetch/);
    assert.equal(attempts, 1);
    assert.equal(globalThis.productSaveTest.writes.length, 1);
});

test('HTML and malformed success responses are surfaced as save failures', async (t) => {
    for (const response of [new Response('<html>Login</html>'), Response.json({}),
        Response.json({ ok: true }, { status: 500 })]) {
        t.mock.method(globalThis, 'fetch', async () => response);
        assert.deepEqual(await saveProduct(input), {
            ok: false, error: 'No se pudo guardar el producto. Intentá de nuevo.'
        });
    }
});
