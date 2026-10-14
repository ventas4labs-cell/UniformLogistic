import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { manualStockSizes, splitStockSize, stockProductSizes } from '../lib/stock-size.ts';

// Resolve the app's TypeScript alias with Node's built-in test runner.
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('@/')) {
            return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
        }
        return nextResolve(specifier, context);
    }
});

const { buildManualStockCatalog, buildVoiceCatalog } = await import('../lib/services/voice-catalog.ts');

const product = (overrides = {}) => ({
    id: 'product-1', product_code: 'TEST-1', name: 'Camisa',
    product_type: 'shirt', gender: 'men', fabric_type: null, is_active: true,
    sizes_json: { men: ['S', 'M', 'L', 'XL'], women: [] },
    ...overrides
});

function expectVariants(sizes, label) {
    for (const size of [label, `Hombre · ${label}`, `Mujer · ${label}`]) {
        assert.ok(sizes.includes(size), `Missing ${size}`);
    }
}

// Model company scoping and active/shared-product filters, not just canned responses.
function stockClient({ assigned = [], basic = [], existing = [], failTable } = {}) {
    return {
        from(table) {
            const filters = [];
            return {
                select() { return this; },
                eq(key, value) { filters.push([key, value]); return this; },
                then(resolve, reject) {
                    const source = { company_products: assigned, products: basic, company_stock: existing }[table];
                    assert.ok(source, `Unexpected table ${table}`);
                    const data = source.filter((row) => filters.every(([key, value]) => row[key] === value));
                    return Promise.resolve({ data, error: table === failTable ? new Error('Read failed') : null })
                        .then(resolve, reject);
                }
            };
        }
    };
}

test('every audience and product type offers XS with either gender or neither', () => {
    for (const gender of ['men', 'women', 'unisex']) {
        for (const product_type of ['shirt', 'pant']) {
            expectVariants(stockProductSizes(product({ gender, product_type })), 'XS');
        }
    }
    expectVariants(stockProductSizes(product({ sizes_json: null })), 'XS');
});

test('women can select XL on a polo even when only its men list includes XL', () => {
    const sizes = stockProductSizes(product({
        name: 'Camisa Tipo Polo', gender: 'unisex',
        sizes_json: { men: ['S', 'M', 'L', 'XL', 'XXL'], women: ['S', 'M', 'L', 'XXL'] }
    }));
    expectVariants(sizes, 'XL');
    assert.equal(sizes.length, new Set(sizes).size);
});

test('configured sizes from either list survive the primary catalog gender', () => {
    const sizes = stockProductSizes(product({ sizes_json: { men: ['S'], women: ['2XL'] } }));
    expectVariants(sizes, 'S');
    expectVariants(sizes, '2XL');
    assert.ok(!sizes.includes('Mujer · L'), 'Do not invent other unconfigured sizes');
});

test('motorcycle cape retains large sizes and accepts its repaired XL configuration', () => {
    const sizes = stockProductSizes(product({
        name: 'Capa Motorizado K9', sizes_json: { men: ['2XL', '3XL', '4XL', '5XL', 'XL'] }
    }));
    for (const label of ['XL', '2XL', '3XL', '4XL', '5XL']) expectVariants(sizes, label);
});

test('both ATO vests support UNITALLA while keeping their configured sizes', () => {
    for (const name of ['Chaleco Reflectivo ATO', 'Chaleco Reflectivo ATO (Plus)']) {
        const sizes = stockProductSizes(product({ name, sizes_json: { men: ['XL', 'UNITALLA'] } }));
        expectVariants(sizes, 'UNITALLA');
        expectVariants(sizes, 'XL');
    }
});

test('pants keep exact checkout SKUs, waist/inseam combinations and optional gender', () => {
    const sizes = stockProductSizes(product({
        product_type: 'pant', sizes_json: { waist: [30, 32], inseam: [28, 30] }
    }));
    for (const label of ['C30" / L28"', 'C30" / L30"', 'C32" / L28"', 'C32" / L30"']) {
        expectVariants(sizes, label);
    }
    expectVariants(stockProductSizes(product({ product_type: 'pant', sizes_json: { waist: [32] } })), 'C32"');
});

test('manual entry keeps optional size and separates gender from the persisted SKU', () => {
    const sizes = manualStockSizes(stockProductSizes(product()));
    expectVariants(sizes, 'No Size');
    for (const gender of [null, 'men', 'women']) {
        const options = sizes.filter((size) => splitStockSize(size).gender === gender);
        assert.ok(options.some((size) => splitStockSize(size).size === 'XS'));
        assert.equal(options.length, new Set(options.map((size) => splitStockSize(size).size)).size);
    }
    assert.deepEqual(splitStockSize('Mujer · XL'), { gender: 'women', size: 'XL' });
});

test('manual and voice catalogs share valid SKUs, reuse stock IDs and scope products to the company', async () => {
    const p = product();
    const client = stockClient({
        assigned: [
            { company_id: 'company-1', is_active: true, product: p },
            { company_id: 'company-1', is_active: true, product: [p] },
            { company_id: 'company-2', is_active: true, product: product({ id: 'foreign' }) },
            { company_id: 'company-1', is_active: false, product: product({ id: 'unassigned' }) },
            { company_id: 'company-1', is_active: true, product: product({ id: 'inactive', is_active: false }) },
            { company_id: 'company-1', is_active: true, product: null }
        ],
        basic: [
            product({ id: 'shared', is_basic: true }),
            product({ id: 'not-basic', is_basic: false })
        ],
        existing: [
            { company_id: 'company-1', id: 'old-stock', product_id: p.id, size: 'Hombre · M' },
            { company_id: 'company-2', id: 'foreign-stock', product_id: p.id, size: 'Mujer · XL' }
        ]
    });
    const voice = await buildVoiceCatalog(client, 'company-1');
    const manual = await buildManualStockCatalog(client, 'company-1');
    assert.deepEqual(new Set(voice.map((entry) => entry.product_id)), new Set([p.id, 'shared']));
    assert.equal(voice.length, new Set(voice.map((entry) => `${entry.product_id}|${entry.size}`)).size);
    const manualKeys = new Set(manual.map((entry) => `${entry.product_id}|${entry.size}`));
    for (const entry of voice) assert.ok(manualKeys.has(`${entry.product_id}|${entry.size}`));
    assert.equal(voice.find((entry) => entry.size === 'Hombre · M').company_stock_id, 'old-stock');
    const womenXL = voice.find((entry) => entry.size === 'Mujer · XL');
    assert.equal(womenXL.company_stock_id, null);
    assert.equal(womenXL.gender, 'women');
});

test('a company without assigned or shared products has no stock catalog', async () => {
    assert.deepEqual(await buildManualStockCatalog(stockClient(), 'company-1'), []);
});

test('catalog read failures propagate instead of offering a partial catalog', async () => {
    for (const failTable of ['company_products', 'products', 'company_stock']) {
        const client = stockClient({
            assigned: [{ company_id: 'company-1', is_active: true, product: product() }], failTable
        });
        await assert.rejects(buildVoiceCatalog(client, 'company-1'), /Read failed/);
    }
});
