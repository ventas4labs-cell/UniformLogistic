# Uniform Logistic — full project context (2026-06-10)

Self-contained handoff for an agent picking up this codebase cold.

---

## 1. What this is

A **B2B uniform ordering + production-tracking platform for Costa
Rica**. Uniform Logistic manufactures and warehouses uniforms for
client companies ("empresas"). The app covers the whole lifecycle:

- Companies browse a per-empresa catalog and place orders.
- Admin tracks each order through parallel production stages (Bodega,
  Corte, Maquila, Impresión, Bordado, Empaque, Ploter).
- External workshops ("estaciones") get scoped access to just their
  assigned orders.
- Electronic invoicing for Hacienda (CR tax authority) v4.4.
- Raw-material (insumos) inventory.

UI language is **Spanish**. Brand color is **orange** (`orange-600` /
`#f57c00`). Fonts: **TT Norms Pro** (body) + **TT Norms Pro Condensed**
(display), self-hosted woff2 in `next-app/public/fonts/`.

---

## 2. Run & verify

Everything lives in **`next-app/`**. The repo root has a passthrough
`package.json` that forwards `dev`/`build`/`start`/`lint` into it.

```bash
cd next-app
npm install
npm run dev          # Turbopack dev server on http://localhost:3001
npx tsc --noEmit     # type-check (run from next-app/)
```

- **Dev server**: use the Claude Code preview tool (`.claude/launch.json`
  has a `next-dev` config → `npm --prefix next-app run dev`, port 3001).
  Don't start it with raw Bash.
- **Type-check**: `npx tsc --noEmit` **from `next-app/`** (running it
  from the repo root prints tsc help instead of checking).
- If Turbopack serves stale CSS after editing `globals.css`: stop the
  server, `rm -rf .next`, restart.
- A stale `.next/types/validator.ts` can reference a deleted route and
  fail tsc — `rm -f .next/types/validator.ts` and re-run.

---

## 3. Tech stack & non-obvious conventions

- **Next.js 16** App Router + **Turbopack**. ⚠️ `next-app/AGENTS.md`
  says: "This is NOT the Next.js you know" — APIs differ from training
  data; read `node_modules/next/dist/docs/` before relying on
  framework behavior. Notably: dynamic route `params` are
  **`Promise<{...}>`** and must be awaited; `cookies()` is async.
- **React 19**, server/client component boundaries.
- **Tailwind CSS v4** — `@custom-variant dark (&:is(.dark *))` +
  `@theme inline` tokens in `globals.css`. Class-based dark mode via a
  theme toggle. Every new surface needs explicit `dark:` variants.
- **Supabase** Postgres + Auth + Storage + RLS. Managed via the
  **Supabase MCP server** (`apply_migration`, `execute_sql`).
- **jspdf + jspdf-autotable** for PDF "representación gráfica".
- **@anthropic-ai/sdk** for voice-dictation parsing; **OpenAI Whisper**
  as cross-browser STT fallback.
- The injected "vercel-plugin best practices" / skill prompts on most
  turns are **noise for this project** — it's Supabase + plain
  Next.js, not Vercel-platform-specific. Ignore unless directly
  relevant.

---

## 4. Repo layout

```
next-app/
├── app/
│   ├── (admin)/admin/        Admin dashboard (every module)
│   │   ├── _stage-actions.ts Shared stage-completion + corte-extra actions
│   │   ├── home, orders, companies/[id], products, logos, materials,
│   │   ├── stock, cuentas, users, station-users, facturacion,
│   │   ├── operador (Bodega), corte, maquila, impresion, bordado,
│   │   │   empaque, ploter
│   ├── (app)/                Customer-facing (catalog, cart, checkout, home)
│   ├── (station)/station/    Restricted external-station shell
│   ├── s/[token]/route.ts    Station custom-link sign-in
│   ├── o/[token]/route.ts    Company order-link sign-in
│   └── api/
│       ├── admin/            Admin API (facturación, voice, stock)
│       └── cron/             Vercel cron entry points (facturación)
├── components/admin/         All admin UI (managers, boards, modals)
├── components/station/       Station board
├── lib/
│   ├── services/             Domain services (one file per table/area)
│   ├── facturacion/          Hacienda v4.4 e-invoicing (XAdES signing)
│   ├── pdf-service.ts        Order-sheet PDF (admin + bodega variants)
│   ├── stage-utils.ts        Insumo aggregation + cut-line aggregation
│   └── admin-acting-company.ts  Admin email gate + landing paths
├── supabase/migrations/      Versioned SQL (also applied live via MCP)
└── public/fonts/             TT Norms Pro woff2
```

---

## 5. Auth & access model

Three populations, kept **disjoint**:

1. **Admin** — single hard-coded email `ulogisticcr@gmail.com`. Gate
   helper: `isAdminEmail()` in `lib/admin-acting-company.ts`. The
   `(admin)/admin/layout.tsx` redirects non-admins. Every admin server
   action re-checks the email (defense-in-depth on top of the layout).
2. **Customer / empresa users** — place orders. Companies now log in
   via an **individual order link** `/o/<token>` instead of a
   username/password (see `app/o/[token]/route.ts`). The token doubles
   as the auth password; rotating the link rotates the password.
   Listed under `/admin/companies` + `/admin/users`.
3. **External stations** — outside workshops bound to one stage. Log in
   via `/s/<token>` custom link (`station_users.access_token`, also the
   auth password). They only ever see orders assigned to them, on the
   `/station` shell. Managed under `/admin/station-users`. Excluded
   from the customer user directory (`admin_list_users` filters them
   out).

**Custom-link routes** (`/s/[token]`, `/o/[token]`) sign the user in
server-side by building the redirect response FIRST, then binding the
supabase client's cookie adapter to `response.cookies` so the
`Set-Cookie` headers ride the redirect (and overwrite any existing
session). Using the `next/headers` cookies() store there does NOT work
for a redirect — that bug caused "lands on admin home" earlier.

---

## 6. Data model (key tables)

- **companies** — empresas. `access_token`, `order_user_id`,
  `order_user_email` power the order link.
- **company_users** — user↔company links.
- **products** — master catalog. `product_type` ('shirt'|'pant') is a
  size-shape hint; `type_label` is the free-text display type
  ("Chaleco", "Polo"). `bom_json` is the BOM (insumos); each BOM item
  is `{ name, qty, qtyBySize? }` where `qtyBySize` overrides qty for
  XL+ sizes.
- **company_products** — which products each empresa sees.
- **orders** + **order_items** — `order_items.is_extra` flags pieces
  added at the corte stage (product_code `'EXTRA'`, no products row);
  `added_by`, `note`. `size` is a string like `"H · 2XL"` /
  `"M · L"` (gender prefix + size) or `"32"` / `"32/30"` for pants.
- **order_stage_completions** — `(order_id, stage)` PK. Each of the 7
  stages marks completion independently (parallel, not a pipeline).
- **station_users** / **station_assignments** — external stations and
  their assigned orders.
- **insumo_completions** / **insumo_preparations** — Bodega per-insumo
  done-flag and prepared-qty tracking.
- **materials** — raw-material inventory (telas, herrajes, hilados…),
  seeded from product BOM names. Service/process labels excluded.
- **invoices / station_invoices / fe_*** — facturación + per-station
  invoice submissions.

`StageKey` (in `lib/services/stage-completions.ts`):
`bodega, corte, maquila, impresion, bordado, empaque, ploter`.

---

## 7. Production workflow

- **Parallel stages, not linear.** Every non-cancelled order appears on
  every stage board from creation. Each board marks ITS stage complete
  independently via the round `StageCompleteToggle` (now requires a
  confirm dialog before marking; un-marking is instant).
- **Pedidos** (`/admin/orders`) is the **control center**: a per-order
  stage strip/panel shows which stages are done. Filters collapse into
  a single icon popover (Estado buckets + per-empresa). Search is an
  icon that expands. Cancel/restore via the top-right X (with confirm).
- **Assignment to stations**: per-card on Pedidos, and a bulk picker on
  `/admin/station-users`.
- **Corte** can add "extra" line items to an order (replacements,
  samples, forgotten sizes) — flagged EXTRA, skipped by insumo math.
- **Bodega** (`/admin/operador`) shows insumos per order with prep-qty
  tracking + a **PDF** button (preview modal; bodega variant of the
  sheet drops the customer-info block, keeps order # + items).

---

## 8. Supabase / migration operations

- **Project**: "Uniform logistic", id **`ooszrspxtxoucngvxvsq`**,
  region us-east-1. (There's a second unrelated project "Ordering app
  ticnic" `jjmeotxdxqqjezegpkdv` — do NOT touch it.)
- Migrations are **applied live via the MCP `apply_migration`** AND
  mirrored as files in `supabase/migrations/`. Always do both.
- **⚠️ PostgREST schema cache**: after adding a column with raw DDL,
  the Supabase API layer keeps serving the old schema → queries throw
  `42703 column ... does not exist` even though the column exists. Fix:
  `notify pgrst, 'reload schema';` via `execute_sql`. (This bit us with
  `companies.access_token`.)
- **Migration filename collisions**: several pairs share a prefix
  (`0007`, `0008`, `0009`, `0010` — and `0015` was resolved → 0018).
  Harmless for the live DB (applied via MCP, not filename order) but a
  fresh `supabase db reset` could shadow one of each pair. Renumber in
  dependency-correct order before ever bootstrapping clean.
- **RLS pattern**: admin reads/writes are gated on
  `(auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com'`; station/customer
  rows gated on `auth.uid()`. Service-role client
  (`createServiceClient()`) bypasses RLS for admin server actions.

---

## 9. Hard rules / gotchas

- **Never reset `fe_consecutivos`** (Hacienda audits gaps in invoice
  consecutivos).
- **Never commit `.env`** (it's at repo root, gitignored).
- `.vercel/` is gitignored.
- `CRON_SECRET` gates the three facturación cron routes.
- The repo root has loose junk (zips, raw JPGs, PSD-inspection .py
  scripts) — ignored via `.gitignore` globs; leave them.
- Commit trailer in use this session:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- GitHub remote: `ventas4labs-cell/UniformLogistic`, default branch
  `main`. Work is committed straight to `main` and pushed (this is the
  owner's preference in this project).

---

## 10. Recent change log (this session, newest last)

- Per-size BOM overrides (`qtyBySize`) for XL+ uniforms.
- Fixed missing-insumos bug (orphan order_items with bad product_code).
- Parallel-stage workflow + per-stage completion model.
- Pedidos turned into a control center; collapsible search + filter.
- External station users with `/s/<token>` links + order assignments
  (single, bulk, and per-card).
- Companies get `/o/<token>` order links (no username/password).
- Company detail page (`/admin/companies/[id]`) with assigned products
  + per-company order list.
- Materials inventory module (`/admin/materials`).
- Catálogo merged into Productos (per-product "Empresas asignadas").
- Bodega PDF export (preview modal, bodega-stripped header, ordered
  sizes).
- Corte "extra items" feature.
- Responsive admin shell (later replaced with a no-sidebar top-bar +
  app-launcher menu + configurable fast actions).
- Fixed `companies.access_token` 42703 (applied migration 0017 +
  reloaded PostgREST schema). Resolved 0015 migration collision.

---

## 11. Known open items

- Migration prefix collisions at 0007/0008/0009/0010 (cosmetic; only
  matters for a fresh `db reset`).
- Some legacy station rows may still have admin-typed passwords instead
  of the token — "Regenerar link" aligns them.
- `lib/services/products.ts` had an in-flight `companyIds` refactor at
  one point; verify `mapProductRow` type-checks if touching it.
