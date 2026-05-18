# Product & Stock Dictation — Implementation Spec (Uniform Logistic)

> Self-contained implementation guide for adding voice-driven stock entry
> **and** product creation to the Uniform Logistic admin panel.
> Adapted from the restaurant-inventory STT spec at
> `~/Desktop/Ticketing/STOCK_DICTATION_FEATURE.md`, retargeted to this
> codebase's schema (`company_stock`, `products`, `company_products`,
> `company_users`) and admin-only access model.
>
> Two flows are documented:
>
> 1. **Stock dictation** — operator says *"recibí 20 Cargo Verde cintura 32
>    y 10 Camisa Reflectiva mujer talla M"*. System resolves each phrase to
>    a `company_stock` SKU for the selected company, shows a review modal,
>    then upserts the rows + writes movement audit entries.
> 2. **Product creation dictation** — operator on `/admin/products` says
>    *"Crear Camisa Polo Roja, mujer, tela algodón, tallas S a XL, CABYS
>    seis dos cero uno…"*. System extracts the product fields, the admin
>    confirms in the existing Product modal, then submits via the existing
>    `createProductAction`.
>
> Both share the same core pattern: **browser `SpeechRecognition` for STT
> → Anthropic Claude with tool calling for structured extraction →
> server-side guardrails before any DB write.** No third-party STT API, no
> audio uploads, no streaming complexity.

---

## 1. Why this design

| Problem | What we do instead |
|---|---|
| Whisper has 5–10 s latency. Operators want to see words appearing. | Browser native `SpeechRecognition` (Chrome / Edge / Safari) streams interim transcripts for free, sub-second. No audio leaves the device. |
| LLMs hallucinate product names that don't exist in the catalog. | Pass the **company-specific catalog** (only products in `company_products` for the chosen company + the sizes from each product's `sizes_json`) into the system prompt **and** the tool schema, then re-validate every UUID server-side. |
| Sizes are domain-specific ("H · M", "M · 2XL", `C32"`, `C32" / L30"`). | Provide the LLM with the canonical size strings already materialized per product. The LLM's job is to map natural speech ("camisa hombre mediana", "cintura 32") to one of those strings — never to invent a new size. |
| One mega "do everything" call → no visibility, no undo. | Three discrete endpoints: **parse** (LLM extracts intent), **review** (operator edits in a modal), **apply** (server upserts rows + writes audit). Each batch is logged. |

Total cost per dictation at production volume: **sub-cent** (Anthropic
API). No new infrastructure.

---

## 2. Architecture at a glance

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER                                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Mic button → SpeechRecognition (es-CR, interim results) │   │
│  │  Live transcript shown to user                            │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                            │ POST /api/admin/stock/voice-parse
│                            │ { transcript, company_id }
│                            ▼
└────────────────────────────┼─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│  SERVER (Next.js route handler, maxDuration = 30)                │
│                                                                   │
│  1. Auth gate: user.email === ADMIN_EMAIL                        │
│  2. Load catalog for chosen company:                              │
│     • products joined via company_products (assigned only)        │
│     • for each product, expand sizes_json → canonical size string │
│     • for each (product, size), pre-resolve company_stock_id      │
│       (one already exists, or null if not yet a SKU)              │
│  3. Build Anthropic Tool whose input_schema requires the LLM to   │
│     pick a {product_id, size} pair from the catalog               │
│  4. Call claude-sonnet-4-5 with tool_choice forced                │
│  5. Filter LLM output: drop any (product_id, size) NOT in catalog │
│                                                                   │
│  ⮕ { transcript, commands[], unmatched[] }                       │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│  BROWSER — Review modal                                          │
│   • Each command editable (product/size dropdown, qty, type)     │
│   • Unmatched mentions shown separately                          │
│   • Confirm → POST /api/admin/stock/voice-apply                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│  SERVER — Apply                                                  │
│   • Re-validate every (product_id, size) belongs to company      │
│   • Loop: upsert_company_stock_movement RPC per command          │
│   • Per-command results collected; partial success allowed       │
│   • Audit row: voice_stock_batches with full snapshot            │
│                                                                   │
│  ⮕ { applied, failed, results[] }                                │
└──────────────────────────────────────────────────────────────────┘
```

The **product-creation** flow swaps the catalog/tool for product-field
extraction and writes through the existing `createProductAction`
server action.

---

## 3. Database changes

### 3.1 Tables that already exist

The relevant existing tables in this project (current schema):

```
companies (id, name, ...)
company_users (id, company_id, user_id, role)
products (
  id, product_code, name, description,
  product_type CHECK IN ('shirt','pant'),
  gender CHECK IN ('men','women','unisex'),
  sizes_json JSONB,           -- {men: [...], women: [...], waist: [...], inseam: [...]}
  fabric_type, image_url, bom_json, codigo_cabys,
  unit_price, iva_rate DEFAULT 13
)
company_products (id, company_id, product_id, custom_price, unit_price, is_active)
company_stock (
  id, company_id, product_id, size TEXT,
  quantity_on_hand INT CHECK ≥ 0, quantity_reserved INT CHECK ≥ 0,
  last_movement_at, updated_at
)
```

> **There is no movement ledger today.** `company_stock.last_movement_at`
> only stores the timestamp of the latest change — historical movements
> aren't retained. The dictation feature needs an audit trail, so we add
> `stock_movements` below.

### 3.2 New tables for this feature

```sql
-- 3.2a Append-only stock movements ledger.
-- Voice movements get a 🎙 prefix in the reason so they stand out.
CREATE TABLE stock_movements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id),
    product_id          UUID NOT NULL REFERENCES products(id),
    size                TEXT NOT NULL,
    type                TEXT NOT NULL CHECK (type IN ('entry','exit','reserve','release','adjustment')),
    quantity            INTEGER NOT NULL CHECK (quantity > 0),
    reason              TEXT,
    source              TEXT,                  -- 'voice' | 'manual' | 'order' | 'production'
    user_id             UUID REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_movements_company    ON stock_movements(company_id, created_at DESC);
CREATE INDEX idx_stock_movements_product    ON stock_movements(product_id, size);

-- 3.2b Audit row per dictation batch: lets you reconstruct
-- "the system thought I said X" disputes after the fact.
CREATE TABLE voice_stock_batches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id),
    user_id             UUID NOT NULL REFERENCES auth.users(id),
    transcript          TEXT NOT NULL,
    parsed_commands     JSONB NOT NULL,        -- what the LLM returned
    applied_commands    JSONB NOT NULL,        -- what the user confirmed (subset, possibly edited)
    applied_count       INT NOT NULL DEFAULT 0,
    failed_count        INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_voice_batches_company ON voice_stock_batches(company_id, created_at DESC);

-- 3.2c Audit row per product-creation dictation.
CREATE TABLE voice_product_drafts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id),
    transcript          TEXT NOT NULL,
    parsed_product      JSONB NOT NULL,
    created_product_id  UUID REFERENCES products(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.3 RLS — must fix before shipping

> 🛑 **Pre-existing security issue surfaced by Supabase:**
> `company_stock`, `invoices`, `invoice_payments`, and `combo_items` have
> Row Level Security **disabled**. With the `anon` key currently in use
> by the Supabase client, every row of those tables is publicly
> readable/writable. The dictation feature writes to `company_stock` and
> the new tables here, so this must be fixed in the same migration.

Apply RLS to all the relevant tables with admin-only / company-member
policies:

```sql
ALTER TABLE company_stock          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices               ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_stock_batches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_product_drafts   ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin? (matches ADMIN_EMAIL in
-- next-app/app/(admin)/admin/layout.tsx). Note: hard-coded email; revisit
-- once the project has a proper role system.
CREATE OR REPLACE FUNCTION is_app_admin() RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT (
        SELECT email FROM auth.users WHERE id = auth.uid()
    ) = 'ulogisticcr@gmail.com'
$$;

-- company_stock: company members can read; only admin can write.
CREATE POLICY company_stock_read ON company_stock FOR SELECT
USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
    OR is_app_admin()
);
CREATE POLICY company_stock_write ON company_stock FOR ALL
USING (is_app_admin()) WITH CHECK (is_app_admin());

-- stock_movements: same model.
CREATE POLICY stock_movements_read ON stock_movements FOR SELECT
USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
    OR is_app_admin()
);
CREATE POLICY stock_movements_write ON stock_movements FOR INSERT
WITH CHECK (is_app_admin());

-- voice_stock_batches / voice_product_drafts: admin-only.
CREATE POLICY voice_stock_batches_admin ON voice_stock_batches FOR ALL
USING (is_app_admin()) WITH CHECK (is_app_admin());
CREATE POLICY voice_product_drafts_admin ON voice_product_drafts FOR ALL
USING (is_app_admin()) WITH CHECK (is_app_admin());
```

(Apply similar policies to `invoices` and `invoice_payments` separately —
out of scope for the dictation feature but needs doing.)

### 3.4 RPC: `upsert_company_stock_movement`

Atomically:
1. Locks the `company_stock` row (or inserts if it doesn't exist).
2. Mutates `quantity_on_hand` / `quantity_reserved` according to `p_type`.
3. Writes a `stock_movements` row.
4. Returns `{ ok, company_stock_id, new_on_hand, new_reserved }`.

```sql
CREATE OR REPLACE FUNCTION upsert_company_stock_movement(
    p_company_id   UUID,
    p_product_id   UUID,
    p_size         TEXT,
    p_type         TEXT,             -- 'entry' | 'exit' | 'reserve' | 'release' | 'adjustment'
    p_quantity     INTEGER,
    p_reason       TEXT DEFAULT NULL,
    p_source       TEXT DEFAULT 'manual'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_row   company_stock%ROWTYPE;
    v_delta_on_hand INT := 0;
    v_delta_reserved INT := 0;
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'quantity must be > 0';
    END IF;
    IF p_type NOT IN ('entry','exit','reserve','release','adjustment') THEN
        RAISE EXCEPTION 'unknown type %', p_type;
    END IF;

    -- Lock-or-create the SKU row.
    SELECT * INTO v_row
    FROM company_stock
    WHERE company_id = p_company_id AND product_id = p_product_id AND size = p_size
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO company_stock (company_id, product_id, size, quantity_on_hand, quantity_reserved)
        VALUES (p_company_id, p_product_id, p_size, 0, 0)
        RETURNING * INTO v_row;
    END IF;

    -- Compute deltas based on movement type.
    CASE p_type
        WHEN 'entry'      THEN v_delta_on_hand :=  p_quantity;
        WHEN 'exit'       THEN v_delta_on_hand := -p_quantity;
        WHEN 'reserve'    THEN v_delta_reserved :=  p_quantity;
        WHEN 'release'    THEN v_delta_reserved := -p_quantity;
        WHEN 'adjustment' THEN
            -- p_quantity is interpreted as the TARGET on_hand; compute delta.
            v_delta_on_hand := p_quantity - v_row.quantity_on_hand;
    END CASE;

    -- Constraint checks (the CHECK on the table enforces >= 0 too, but
    -- we raise a friendlier message).
    IF v_row.quantity_on_hand + v_delta_on_hand < 0 THEN
        RAISE EXCEPTION 'insufficient on_hand: have %, need %',
            v_row.quantity_on_hand, ABS(v_delta_on_hand);
    END IF;
    IF v_row.quantity_reserved + v_delta_reserved < 0 THEN
        RAISE EXCEPTION 'cannot release more than reserved';
    END IF;
    IF (v_row.quantity_on_hand + v_delta_on_hand) <
       (v_row.quantity_reserved + v_delta_reserved) THEN
        RAISE EXCEPTION 'reservation would exceed available stock';
    END IF;

    UPDATE company_stock
       SET quantity_on_hand   = quantity_on_hand   + v_delta_on_hand,
           quantity_reserved  = quantity_reserved  + v_delta_reserved,
           last_movement_at   = now(),
           updated_at         = now()
     WHERE id = v_row.id;

    INSERT INTO stock_movements (
        company_id, product_id, size, type, quantity, reason, source, user_id
    ) VALUES (
        p_company_id, p_product_id, p_size, p_type,
        CASE WHEN p_type = 'adjustment' THEN ABS(v_delta_on_hand) ELSE p_quantity END,
        p_reason, COALESCE(p_source, 'manual'), auth.uid()
    );

    RETURN jsonb_build_object(
        'ok', true,
        'company_stock_id', v_row.id,
        'on_hand',   v_row.quantity_on_hand   + v_delta_on_hand,
        'reserved',  v_row.quantity_reserved  + v_delta_reserved
    );
END $$;

REVOKE ALL ON FUNCTION upsert_company_stock_movement FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_company_stock_movement TO authenticated;
```

Phase 1 of the voice feature only uses `entry` (received pieces).
The RPC supports the other types for later flows (despacho, reservas,
ajustes físicos).

---

## 4. Building the catalog the LLM sees

The hardest part of this feature is **giving the LLM exactly the SKUs it
is allowed to pick from**. The output is a list like:

```ts
// One entry per (product × size) for the selected company.
{
    product_id: "uuid-1",
    product_code: "col-azul-h",
    product_name: "Columbia Azul de Hombre",
    product_type: "shirt",
    gender: "men",
    size: "H · M",
    company_stock_id: "uuid-A" | null   // null when no row exists yet
}
```

Build it server-side from three sources:

```ts
// next-app/lib/services/voice-catalog.ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

interface CatalogEntry {
    product_id: string;
    product_code: string;
    product_name: string;
    product_type: 'shirt' | 'pant';
    gender: 'men' | 'women' | 'unisex';
    size: string;           // canonical "H · M" / "C32\"" / "C32\" / L30\"" string
    fabric_type: string | null;
    company_stock_id: string | null;
}

/**
 * Expand a product's sizes_json into the canonical size strings used by
 * the customer checkout & company_stock. Mirrors selectionToSizeString
 * from lib/services/orders.ts so voice-parsed sizes match exactly what
 * goes through the order pipeline.
 */
function expandSizes(p: {
    product_type: 'shirt' | 'pant';
    gender: 'men' | 'women' | 'unisex';
    sizes_json: {
        men?: string[]; women?: string[];
        waist?: number[]; inseam?: number[];
    };
}): string[] {
    if (p.product_type === 'shirt') {
        const out: string[] = [];
        if (p.gender === 'unisex') {
            // Unisex shirts get separate H · / M · variants when both lists exist
            (p.sizes_json.men || []).forEach(s => out.push(`H · ${s}`));
            (p.sizes_json.women || []).forEach(s => out.push(`M · ${s}`));
            if (out.length === 0) (p.sizes_json.men || p.sizes_json.women || []).forEach(s => out.push(s));
        } else {
            const list = p.gender === 'men' ? p.sizes_json.men : p.sizes_json.women;
            const prefix = p.gender === 'men' ? 'H · ' : 'M · ';
            (list || []).forEach(s => out.push(`${prefix}${s}`));
        }
        return out;
    } else {
        const out: string[] = [];
        const waists = p.sizes_json.waist || [];
        const inseams = p.sizes_json.inseam || [];
        if (inseams.length > 0) {
            for (const w of waists) for (const i of inseams) out.push(`C${w}" / L${i}"`);
        } else {
            for (const w of waists) out.push(`C${w}"`);
        }
        return out;
    }
}

export async function buildVoiceCatalog(
    supabase: SupabaseClient,
    companyId: string
): Promise<CatalogEntry[]> {
    // 1. Products this company can order
    const { data: assigned } = await supabase
        .from('company_products')
        .select('product:products(id, product_code, name, product_type, gender, sizes_json, fabric_type)')
        .eq('company_id', companyId)
        .eq('is_active', true);

    const products = (assigned || [])
        .map(row => row.product)
        .filter(Boolean)
        .map(p => Array.isArray(p) ? p[0] : p);

    // 2. Existing SKU rows for this company (so we can populate company_stock_id)
    const { data: existing } = await supabase
        .from('company_stock')
        .select('id, product_id, size')
        .eq('company_id', companyId);
    const existingMap = new Map(
        (existing || []).map(r => [`${r.product_id}|${r.size}`, r.id])
    );

    // 3. Cartesian expand
    const catalog: CatalogEntry[] = [];
    for (const p of products) {
        for (const size of expandSizes(p)) {
            catalog.push({
                product_id: p.id,
                product_code: p.product_code,
                product_name: p.name,
                product_type: p.product_type,
                gender: p.gender,
                size,
                fabric_type: p.fabric_type,
                company_stock_id: existingMap.get(`${p.id}|${size}`) ?? null
            });
        }
    }
    return catalog;
}
```

> **Catalog size budget.** A typical client has 6–15 products × ~6 sizes
> ≈ 100 entries. At ~80 chars per entry, that's ~8 KB in the prompt —
> well under any token limit. If a client grows past ~30 products, split
> the catalog by product_type (shirts vs pants) and route the dictation
> through two LLM calls.

---

## 5. Server endpoints

All under `next-app/app/api/admin/...` as App Router route handlers.
Patterns mirror the existing admin actions (auth gate, supabase server
client, RPC calls).

### 5.1 `POST /api/admin/stock/voice-parse`

**Request**

```json
{
  "transcript": "recibí 20 Cargo Verde cintura 32 y 10 Camisa Reflectiva mujer talla M",
  "company_id": "uuid-of-company"
}
```

**Response**

```json
{
  "transcript": "...",
  "commands": [
    {
      "product_id": "uuid-pant",
      "product_name": "Cargo Verde",
      "product_code": "cargo-verde",
      "size": "C32\"",
      "company_stock_id": "uuid-existing-or-null",
      "type": "entry",
      "quantity": 20,
      "reason": "Recepción por voz",
      "confidence": 0.95
    },
    {
      "product_id": "uuid-shirt",
      "product_name": "Camisa Reflectiva",
      "product_code": "jacket-ref-m",
      "size": "M · M",
      "company_stock_id": null,
      "type": "entry",
      "quantity": 10,
      "reason": "Recepción por voz",
      "confidence": 0.88
    }
  ],
  "unmatched": [
    { "raw": "tres docenas de gorras", "quantity": 36, "unit": "un" }
  ],
  "warning": null
}
```

**Implementation outline**

```ts
// next-app/app/api/admin/stock/voice-parse/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/utils/supabase/server';
import { buildVoiceCatalog } from '@/lib/services/voice-catalog';

const ADMIN_EMAIL = 'ulogisticcr@gmail.com';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
    const { transcript, company_id } = await req.json();
    if (!transcript || transcript.length > 2000) return NextResponse.json({ error: 'transcripción inválida' }, { status: 400 });
    if (!company_id) return NextResponse.json({ error: 'company_id requerido' }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    if ((user.email || '').toLowerCase() !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'sólo admin' }, { status: 403 });
    }

    const catalog = await buildVoiceCatalog(supabase, company_id);
    if (catalog.length === 0) {
        return NextResponse.json({
            transcript, commands: [], unmatched: [],
            warning: 'Esta empresa no tiene productos asignados. Asignalos en /admin/catalog.'
        });
    }

    // Catalog lines for the prompt. Use a stable, machine-parsable format
    // so the LLM has the exact size strings to copy.
    const catalogLines = catalog.map((c, i) =>
        `${i + 1}. [pid=${c.product_id}] ${c.product_code} · ${c.product_name} (${
            c.product_type === 'shirt' ? 'Camisa' : 'Pantalón'
        }, ${c.gender}) — talla "${c.size}"`
    ).join('\n');

    const tool = {
        name: 'registrar_movimientos_stock',
        description:
            'Registra una lista de movimientos de stock derivados del dictado. ' +
            'Cada movimiento DEBE referenciar un product_id existente del catálogo y ' +
            'usar una de las tallas EXACTAS listadas para ese producto. NO inventes UUIDs ' +
            'ni tallas que no están en el catálogo.',
        input_schema: {
            type: 'object',
            properties: {
                commands: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            product_id: { type: 'string', description: 'UUID del catálogo' },
                            size:       { type: 'string', description: 'Cadena exacta tal como aparece en el catálogo' },
                            quantity:   { type: 'number' },
                            type:       { type: 'string', enum: ['entry'], description: 'Phase 1: sólo entradas' },
                            reason:     { type: 'string' },
                            confidence: { type: 'number' }
                        },
                        required: ['product_id', 'size', 'quantity', 'type', 'reason', 'confidence']
                    }
                },
                unmatched: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            raw:      { type: 'string' },
                            quantity: { type: ['number', 'null'] },
                            unit:     { type: ['string', 'null'] }
                        },
                        required: ['raw']
                    }
                }
            },
            required: ['commands', 'unmatched']
        }
    };

    const systemPrompt = `Eres un asistente que extrae movimientos de stock de uniformes a partir de transcripciones de voz en español de Costa Rica.

Reglas estrictas:
- Sólo aceptás ENTRADAS de stock (recibí, llegó, ingresó, agregar, sumar). Otros tipos van a 'unmatched'.
- Sólo usás product_id que aparezcan EXACTAMENTE en el catálogo de abajo.
- Para la talla, copiá UNA de las cadenas exactas listadas para ese producto. No inventes tallas nuevas.
- Convertí números escritos en palabras a dígitos ("veinte" → 20, "tres docenas" → 36).
- Mapeá el lenguaje natural a tallas canónicas:
  • "hombre talla M" → "H · M"     (camisa men)
  • "mujer XL"       → "M · XL"    (camisa women)
  • "cintura 32"     → "C32\""     (pantalón sin inseam)
  • "cintura 34 largo 30" → "C34\" / L30\""  (pantalón con inseam)
  • "mediana" → M, "extra grande" → XL, "doble extra grande" → 2XL
- Si hay ambigüedad de producto ("camisa azul" cuando hay dos productos azules), elegí el más probable y bajá confidence a 0.6.
- Si el producto/talla mencionado NO está en el catálogo, NO inventes nada — ponelo en 'unmatched' con la frase original.
- 'reason' por defecto es "Recepción por voz" salvo que el usuario diga otra cosa explícita (p.ej. "OC 1234").

CATÁLOGO DISPONIBLE PARA ESTA EMPRESA:
${catalogLines}`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const resp = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: systemPrompt,
        tools: [tool],
        tool_choice: { type: 'tool', name: 'registrar_movimientos_stock' },
        messages: [{ role: 'user', content: `Transcripción: "${transcript}"` }]
    });

    const toolUse = resp.content.find((b: any) => b.type === 'tool_use');
    const args = (toolUse?.input ?? { commands: [], unmatched: [] }) as {
        commands: any[]; unmatched: any[];
    };

    // DEFENSE IN DEPTH: drop anything pointing at a (product_id, size) NOT in catalog
    const validKeys = new Set(catalog.map(c => `${c.product_id}|${c.size}`));
    const byKey = new Map(catalog.map(c => [`${c.product_id}|${c.size}`, c]));

    const commands = (args.commands ?? [])
        .filter(c =>
            validKeys.has(`${c.product_id}|${c.size}`) &&
            Number(c.quantity) > 0 &&
            c.type === 'entry'
        )
        .map(c => {
            const entry = byKey.get(`${c.product_id}|${c.size}`)!;
            return {
                product_id: entry.product_id,
                product_name: entry.product_name,
                product_code: entry.product_code,
                size: entry.size,
                company_stock_id: entry.company_stock_id, // may be null
                type: 'entry' as const,
                quantity: Math.floor(Number(c.quantity)),
                reason: String(c.reason ?? 'Recepción por voz').slice(0, 200),
                confidence: Math.max(0, Math.min(1, Number(c.confidence ?? 0.7)))
            };
        });

    const unmatched = (args.unmatched ?? []).map(u => ({
        raw: String(u.raw ?? '').slice(0, 200),
        quantity: u.quantity != null ? Number(u.quantity) : null,
        unit: u.unit != null ? String(u.unit) : null
    }));

    return NextResponse.json({ transcript, commands, unmatched, warning: null });
}
```

### 5.2 `POST /api/admin/stock/voice-apply`

**Request**

```json
{
  "company_id": "uuid",
  "transcript": "recibí 20 Cargo Verde cintura 32",
  "parsed_commands": [...],
  "commands": [
    { "product_id": "uuid-1", "size": "C32\"", "type": "entry", "quantity": 20, "reason": "OC 4521" }
  ]
}
```

**Response**

```json
{
  "applied": 1,
  "failed": 0,
  "results": [
    {
      "product_id": "uuid-1", "size": "C32\"", "quantity": 20,
      "ok": true,
      "company_stock_id": "uuid-A", "new_on_hand": 35
    }
  ]
}
```

**Implementation outline**

```ts
// next-app/app/api/admin/stock/voice-apply/route.ts
export async function POST(req: NextRequest) {
    const { company_id, transcript, parsed_commands, commands } = await req.json();
    if (!commands?.length) return NextResponse.json({ error: 'sin comandos' }, { status: 400 });
    if (commands.length > 50) return NextResponse.json({ error: 'lote demasiado grande' }, { status: 413 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    if ((user.email || '').toLowerCase() !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'sólo admin' }, { status: 403 });
    }

    // Re-validate every (product_id, size) belongs to this company's catalog.
    const catalog = await buildVoiceCatalog(supabase, company_id);
    const validKeys = new Set(catalog.map(c => `${c.product_id}|${c.size}`));

    const results: any[] = [];
    for (const cmd of commands) {
        const key = `${cmd.product_id}|${cmd.size}`;
        if (!validKeys.has(key)) {
            results.push({ ...cmd, ok: false, error: 'producto/talla no asignado a esta empresa' });
            continue;
        }
        if (!Number.isInteger(cmd.quantity) || cmd.quantity <= 0) {
            results.push({ ...cmd, ok: false, error: 'cantidad inválida' });
            continue;
        }
        if (cmd.type !== 'entry') {
            results.push({ ...cmd, ok: false, error: 'Phase 1 sólo soporta entradas' });
            continue;
        }

        const reason = (cmd.reason ?? 'Recepción por voz').slice(0, 200);
        const { data, error } = await supabase.rpc('upsert_company_stock_movement', {
            p_company_id: company_id,
            p_product_id: cmd.product_id,
            p_size: cmd.size,
            p_type: 'entry',
            p_quantity: cmd.quantity,
            p_reason: `🎙 ${reason}`,
            p_source: 'voice'
        });
        if (error) {
            results.push({ ...cmd, ok: false, error: error.message });
        } else {
            results.push({
                ...cmd, ok: true,
                company_stock_id: (data as any).company_stock_id,
                new_on_hand: (data as any).on_hand
            });
        }
    }

    const applied = results.filter(r => r.ok).length;
    const failed = results.length - applied;

    // Audit log — best-effort. If this insert fails the movements are still in the ledger.
    await supabase.from('voice_stock_batches').insert({
        company_id, user_id: user.id, transcript,
        parsed_commands, applied_commands: commands,
        applied_count: applied, failed_count: failed
    });

    return NextResponse.json({ applied, failed, results });
}
```

### 5.3 `POST /api/admin/products/voice-parse`

Product creation. Extracts the fields of a new product from a single
dictation. Output schema mirrors the existing `ProductInput` type in
`next-app/lib/services/products.ts`.

**Request**

```json
{
  "transcript": "crear producto Camisa Polo Roja, mujer, tela algodón, tallas S a XL, código CABYS seis dos cero uno cero cero cero cero cero cero cero cero cero, precio doce mil quinientos colones"
}
```

**Response**

```json
{
  "transcript": "...",
  "product": {
    "productCode": "polo-rojo-m",            // suggested, admin can override
    "name": "Camisa Polo Roja",
    "description": null,
    "productType": "shirt",
    "gender": "women",
    "sizes": { "women": ["S", "M", "L", "XL"] },
    "fabricType": "Algodón",
    "codigoCabys": "6201000000000",
    "unitPrice": 12500,
    "confidence": 0.9
  }
}
```

**Tool schema highlights** — every field nullable so partial dictations
work (admin can dictate the rest into the existing form):

```ts
const tool = {
    name: 'crear_producto_desde_voz',
    description:
        'Extrae los campos de un producto nuevo. Para CADA campo: si el usuario ' +
        'lo mencionó, devolvé el valor; si no, devolvé null para que el formulario ' +
        'lo deje vacío. NO inventes valores.',
    input_schema: {
        type: 'object',
        properties: {
            name:         { type: ['string', 'null'] },
            description:  { type: ['string', 'null'] },
            productType:  { type: ['string', 'null'], enum: ['shirt', 'pant', null] },
            gender:       { type: ['string', 'null'], enum: ['men', 'women', 'unisex', null] },
            // sizes: a normalized shape; tool tells the LLM how to fill it.
            sizes_men:    { type: ['array', 'null'], items: { type: 'string' } },
            sizes_women:  { type: ['array', 'null'], items: { type: 'string' } },
            sizes_waist:  { type: ['array', 'null'], items: { type: 'number' } },
            sizes_inseam: { type: ['array', 'null'], items: { type: 'number' } },
            fabricType:   { type: ['string', 'null'] },
            codigoCabys:  { type: ['string', 'null'], description: '13 dígitos exactos. Convertí palabras a números.' },
            unitPrice:    { type: ['number', 'null'], description: 'En colones. "doce mil" → 12000' },
            confidence:   { type: 'number' }
        },
        required: [
            'name','description','productType','gender',
            'sizes_men','sizes_women','sizes_waist','sizes_inseam',
            'fabricType','codigoCabys','unitPrice','confidence'
        ]
    }
};
```

**System prompt extras** (in addition to the standard rules):

```
- "tallas S a XL" → ["S","M","L","XL"] (expandir el rango con la
  progresión XS,S,M,L,XL,2XL,3XL,4XL,5XL).
- "cintura 28 a 38 de dos en dos" → [28,30,32,34,36,38].
- "ropa de mujer" implica gender='women' Y sizes_women si menciona tallas alfa.
- "unisex" implica que tanto sizes_men como sizes_women pueden poblarse.
- "CABYS uno dos tres..." → concatená los dígitos. Si no llega a 13, dejá codigoCabys=null y mové la frase a 'unmatched' del lado del cliente.
- Para productCode, NO lo inventes — el cliente lo deriva del name después.
```

**Server-side validation** before returning:
- `name` is non-empty.
- `productType`, `gender` are in the enum.
- `codigoCabys` is exactly 13 digits or `null` (use existing
  `validateCABYS` from `lib/facturacion/validation/cabys-validator`).
- `unitPrice` is finite and ≥ 0 or `null`.
- The `sizes_*` arrays match `productType` (a shirt with `sizes_waist`
  filled is suspicious — clamp it to `null`).

**Audit:** insert a `voice_product_drafts` row after parsing (even if
the admin doesn't end up submitting). `created_product_id` is updated to
the new product UUID once `createProductAction` runs.

---

## 6. Client UI

### 6.1 Stock dictation — `<VoiceStockDictate />`

Lives in `next-app/components/admin/voice-stock-dictate.tsx`. Mounted
inside the new `/admin/stock` page header (next to the search box). The
admin first picks a company (already exists in that view's filters), then
clicks the mic.

State machine: `idle → recording → parsing → review → applying → done`.

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2, Check, AlertTriangle } from 'lucide-react';

interface ParsedCommand {
    product_id: string;
    product_name: string;
    product_code: string;
    size: string;
    company_stock_id: string | null;
    type: 'entry';
    quantity: number;
    reason: string;
    confidence: number;
}

interface VoiceStockDictateProps { companyId: string; companyName: string; }

export function VoiceStockDictate({ companyId, companyName }: VoiceStockDictateProps) {
    const [phase, setPhase] = useState<'idle'|'recording'|'parsing'|'review'|'applying'>('idle');
    const [interim, setInterim] = useState('');
    const finalBufRef = useRef('');
    const userStoppedRef = useRef(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    const [parsed, setParsed] = useState<{ commands: ParsedCommand[]; unmatched: any[] } | null>(null);
    const [edited, setEdited] = useState<ParsedCommand[]>([]);

    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

    const getCtor = () =>
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const start = () => {
        const Ctor = getCtor();
        if (!Ctor) { alert('Tu navegador no soporta dictado. Usá Chrome o Safari.'); return; }
        if (!window.isSecureContext) { alert('Dictado requiere HTTPS.'); return; }

        userStoppedRef.current = false;
        finalBufRef.current = '';
        setInterim('');
        const r = new Ctor() as SpeechRecognition;
        r.continuous = !isIOS;
        r.interimResults = true;
        r.lang = 'es-CR';

        r.onresult = (e: SpeechRecognitionEvent) => {
            let interimText = '', finalText = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0]?.transcript ?? '';
                if (!t) continue;
                if (e.results[i].isFinal) finalText += t; else interimText += t;
            }
            if (finalText) finalBufRef.current += finalText;
            setInterim(interimText);
        };
        r.onend = () => {
            // iOS auto-stops; restart unless the user pressed stop
            if (!userStoppedRef.current && isIOS) try { r.start(); } catch {}
        };
        r.onerror = (e: any) => {
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                alert('Permiso de micrófono denegado.');
                userStoppedRef.current = true;
            }
        };
        recognitionRef.current = r;
        r.start();
        setPhase('recording');
    };

    const stop = async () => {
        userStoppedRef.current = true;
        recognitionRef.current?.stop();
        await new Promise(r => setTimeout(r, 200)); // let iOS flush trailing words
        const transcript = (finalBufRef.current + ' ' + interim).trim();
        if (!transcript) { setPhase('idle'); return; }
        setPhase('parsing');
        const res = await fetch('/api/admin/stock/voice-parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript, company_id: companyId })
        });
        const data = await res.json();
        setParsed(data);
        setEdited(data.commands);
        setPhase('review');
    };

    const apply = async () => {
        if (!parsed) return;
        setPhase('applying');
        const res = await fetch('/api/admin/stock/voice-apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company_id: companyId,
                transcript: parsed['transcript' as any] || '',
                parsed_commands: parsed.commands,
                commands: edited
            })
        });
        const data = await res.json();
        // Show toast with applied/failed counts; refresh the /admin/stock data.
        setPhase('done');
    };

    // ... render the mic button + review modal here
}
```

The **review modal** lists each command as an editable row:

| Producto | Talla | Cantidad | Confianza | Acciones |
|---|---|---|---|---|
| Cargo Verde (`cargo-verde`) | `C32"` | `20` | 0.95 ✓ | 🗑 |
| Camisa Reflectiva (`jacket-ref-m`) | `M · M` | `10` | 0.88 ⚠ | 🗑 |

- Confidence < 0.7 → row gets amber background (operator double-checks).
- "Talla" cell is a dropdown of the canonical sizes for that product so
  the operator can fix mis-matches without re-dictating.
- "Reason" defaults to "Recepción por voz" — editable inline (e.g.,
  "OC 4521").
- Unmatched phrases list below the table with a hint: "Estos no se
  registrarán. Asignalos al catálogo de la empresa primero."

### 6.2 Product creation — `<VoiceProductDictate />`

Mounted inside the existing "Nuevo Producto" button area in
`/admin/products` (`components/admin/products-manager.tsx`). On dictation
end, the parsed fields **prefill the existing modal** — they don't bypass
it. The admin still confirms in the same form they already know.

```tsx
const startProductFromVoice = async () => {
    const transcript = await dictateOnce();          // small helper, single chunk
    const res = await fetch('/api/admin/products/voice-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
    });
    const { product } = await res.json();

    // Merge into emptyForm; admin can still edit before save.
    setForm({
        ...emptyForm,
        ...(product.name        != null ? { name: product.name } : {}),
        ...(product.productType != null ? { productType: product.productType } : {}),
        ...(product.gender      != null ? { gender: product.gender } : {}),
        ...(product.fabricType  != null ? { fabricType: product.fabricType } : {}),
        ...(product.codigoCabys != null ? { codigoCabys: product.codigoCabys } : {}),
        ...(product.unitPrice   != null ? { unitPrice: product.unitPrice } : {}),
        sizes: {
            men:    product.sizes_men    ?? [],
            women:  product.sizes_women  ?? [],
            waist:  product.sizes_waist  ?? [],
            inseam: product.sizes_inseam ?? []
        },
        // productCode left empty — let the admin slug it from the name.
    });
    setShowForm(true);
};
```

The flow is **dictate → review in the existing form → save**, not
dictate → auto-create. Two reasons:

1. The product is a permanent catalog entry with downstream coupling
   (CABYS, BOM, image). Voice should accelerate data entry, not bypass
   review.
2. The existing form already has CABYS validation, image upload, and BOM
   editing — voice should feed into that, not duplicate it.

---

## 7. SpeechRecognition gotchas

Same gotchas as the source spec. Critical ones to repeat for this team:

| Situation | Fix |
|---|---|
| **Firefox** has no `SpeechRecognition` | Feature-detect; disable the mic button with a "Usá Chrome o Safari" tooltip. |
| **iOS Safari + `continuous: true`** | Auto-stops. Set `continuous = false` on iOS and auto-restart on `onend` unless `userStoppedRef.current === true`. |
| **iOS PWA standalone (Home Screen)** | Historically blocked. Detect `window.navigator.standalone` and warn. |
| **HTTP origin** | API throws. Detect via `window.isSecureContext`. |
| **Trailing words lost on stop** | `await new Promise(r => setTimeout(r, 200))` after `stop()` and include `interimTranscript` in the final concatenation. |
| **Mic permission denied** | `error === "not-allowed"` → toast + set `userStoppedRef` to prevent restart loop. |
| **iOS restart loses transcript** | Use a `useRef` to accumulate finals across restarts; React state isn't visible inside stale closures. |
| **User-gesture required for `start()`** | The button's `onClick` must call `start()` synchronously — no `await` before it. |

The customer-facing customer dashboard is desktop-first so we don't have
to worry about iOS for the admin flow, but Safari on macOS uses the same
WebKit code path — the gotchas still apply there.

---

## 8. Anthropic SDK usage notes

- **Package**: `@anthropic-ai/sdk` (latest as of writing, v0.80+).
  Already a peer dep candidate — add via `pnpm add @anthropic-ai/sdk` if
  not present.
- **Model**: `claude-sonnet-4-5` for both endpoints. Haiku is tempting
  for cost but the size-mapping ambiguity benefits from Sonnet's
  reasoning ("mujer talla mediana" vs "mediana mujer"). Total cost per
  dictation: well under $0.01.
- **`tool_choice: { type: 'tool', name: '...' }`** is **forced** so
  Claude always emits structured output, never prose. Don't omit it.
- **`max_tokens`**: 2048 for stock batch parse, 1024 for product
  extraction.
- **`maxDuration`**: `export const maxDuration = 30` on the route
  handlers (Vercel Fluid Compute default is plenty, but be explicit).
  Typical round-trip is 2–5 s; long catalogs can stretch to 10–15 s.
- **Errors**: try/catch around `messages.create`, return 502 with a
  generic message. Never leak raw Anthropic JSON to the client — log
  details server-side.
- **Env var**: `ANTHROPIC_API_KEY` in Vercel (Production + Preview). Add
  to `.env.example` so future contributors know to set it.

---

## 9. Defensive principles, in order of importance

1. **Never trust the LLM's `product_id` or `size`.** Re-validate against
   the catalog server-side on both `voice-parse` (after the call) and
   `voice-apply` (before the RPC). A jailbroken LLM that produces a
   foreign UUID gets dropped silently.
2. **Auth-gate every endpoint.** Both `/voice-parse` and `/voice-apply`
   require `user.email === ADMIN_EMAIL`. The product extractor can drop
   the company check but still must be admin.
3. **Enforce RLS first.** `company_stock` and the new tables must have
   RLS enabled before this ships — see §3.3. Without RLS, the dictation
   route is the least of your problems.
4. **Cap inputs.** `transcript ≤ 2000 chars`, `commands ≤ 50 per batch`.
5. **Cap LLM output.** `max_tokens: 2048` for batch parse, `1024` for
   product extraction.
6. **Audit everything written.** `voice_stock_batches` stores transcript
   + LLM output + confirmed payload. `voice_product_drafts` the same.
   Disputes get resolved with actual data.
7. **Confidence is shown, not enforced.** Don't auto-apply commands with
   `confidence < X` — show them in yellow and let the operator decide.
8. **Partial success is the default.** If 9/10 RPCs succeed, return
   `{applied: 9, failed: 1, results: [...]}`. The RPC takes a row lock
   so concurrent deductions can't race; per-command failures don't
   poison the rest of the batch.
9. **Mark voice movements distinctly.** RPC reason prefixed `🎙 …` and
   `source = 'voice'` in `stock_movements`.

---

## 10. Cost & latency budget (rough)

| Step | Time | Cost |
|---|---|---|
| Browser STT (interim → final) | < 200 ms after pause | $0 |
| `/voice-parse` round-trip (100-SKU catalog, 5-command batch) | 2–4 s | ~$0.003 |
| Review modal interaction | user-paced | $0 |
| `/voice-apply` (5 RPC calls sequentially) | 200–400 ms | $0 (DB only) |
| `/products/voice-parse` (product extraction) | 1–2 s | ~$0.001 |

Typical end-to-end:
- **Stock batch dictation**: ~5 s, ~$0.005 per session.
- **Product creation**: ~10 s including form review, ~$0.001.

---

## 11. Phasing

| Phase | Scope | Deps |
|---|---|---|
| **0 — Schema hardening** (must precede everything) | Enable RLS on `company_stock`, `invoices`, `invoice_payments`. Add `stock_movements`, `voice_stock_batches`, `voice_product_drafts` tables. Create `upsert_company_stock_movement` RPC. | none |
| **1 — Stock entries** | `/api/admin/stock/voice-parse` + `/voice-apply`, `VoiceStockDictate` component embedded in `/admin/stock` company filter. Only `type='entry'`. | Phase 0 |
| **2 — Product creation** | `/api/admin/products/voice-parse`, `VoiceProductDictate` button on `/admin/products`. | Phase 0 (audit tables only) |
| **3 — Exits / reservas / ajustes** | Extend tool enum to `entry | exit | reserve | release | adjustment`. New verb sets in system prompt ("despaché", "reservé", "el conteo dice"). RPC already supports all types. | Phase 1 |
| **4 — Whisper fallback** | For browsers without `SpeechRecognition` (Firefox), add `MediaRecorder` → `/api/admin/stock/voice-transcribe` → Whisper API → reuse the same parse step. | Phase 1 |
| **5 — Multi-language** | The current system prompt is es-CR. Add `?lang=en-US` to swap prompts + tool descriptions. Cheap once the framework is in place. | Phase 1 |

---

## 12. File-by-file plan

Where each new piece lands in the existing project structure:

| Path | Purpose |
|---|---|
| `next-app/supabase/migrations/0002_voice_dictation.sql` | Tables + RPC + RLS policies from §3.2–§3.4. |
| `next-app/lib/services/voice-catalog.ts` | `buildVoiceCatalog(supabase, companyId)` from §4. |
| `next-app/app/api/admin/stock/voice-parse/route.ts` | Stock batch parse endpoint. |
| `next-app/app/api/admin/stock/voice-apply/route.ts` | Stock apply endpoint (RPC loop + audit). |
| `next-app/app/api/admin/products/voice-parse/route.ts` | Product extraction endpoint. |
| `next-app/components/admin/voice-stock-dictate.tsx` | Mic button + review modal (Phase 1). |
| `next-app/components/admin/voice-product-dictate.tsx` | Mic button + form prefill (Phase 2). |
| `next-app/components/admin/admin-stock-board.tsx` | Insert `<VoiceStockDictate companyId={selectedCompany.id} />` next to expand/colapsar buttons when exactly one company is filtered. |
| `next-app/components/admin/products-manager.tsx` | Add a "Crear por voz" button next to "Nuevo Producto". |
| `next-app/.env.example` | `ANTHROPIC_API_KEY=` placeholder. |

Total new code: ~1,200 lines including the migration. No regression risk
on existing flows since the dictation paths only call `upsert_company_stock_movement`
(new RPC) and the existing `createProductAction` (unchanged signature).
