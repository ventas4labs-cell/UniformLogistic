# Logos on boards · uniform cards · outsourcing visibility (2026-06-10)

Delta handoff. Builds on
[0001](./0001-2026-06-10-full-project-context.md) — read that first for
the full project picture. This file covers one work session.

---

## 1. Logos per order on the Bordado & Impresión boards

Operators on the **Bordado** and **Impresión** boards can now see the
logos each order's products carry, with their instructions.

- **Data path**: logos attach to products through the product BOM —
  `bom_json` rows can carry `logoId` / `logoImageUrl` / `logoCategory`
  (snapshots) — see `BomItem` in `lib/services/products.ts`. Order
  items already expose `bom` (from the products join in
  `services/orders.ts`), so no new query is needed to know an order's
  logos.
- **Component**: `components/admin/order-logos-modal.tsx` exports
  `OrderLogosButton({ order, category, logos })`. It walks the order's
  items, keeps BOM rows whose `logoCategory` matches the board, dedupes
  by product, and joins the **live** logos catalog (`fetchLogos`) for
  `size` + `notes` (so catalog edits show immediately). The modal lists
  logos grouped by product: image, name, catalog size, per-product
  placement, and global notes. Hovering a thumbnail pops a
  viewport-centered enlarged preview (fixed, `pointer-events-none`, so
  the modal's `overflow-hidden` can't clip it).
- **Wiring**: `bordado/page.tsx` (via `SimpleStageBoard`, which maps
  `bordado → 'bordado'` in `STAGE_LOGO_CATEGORY`) and `impresion/page.tsx`
  (via `ImpresionBoard`) both `fetchLogos` and render the button. Empaque
  / Ploter use `SimpleStageBoard` but have no logo category → no button.
- **Note on "Sublimado"**: the owner calls the printing board
  "sublimado"; it is the existing **Impresión** board / `impresion`
  logo category. Not renamed. No separate stage was added.

## 2. Per-product logo placement / instruction

- `BomItem.logoPlacement?: string` (new, in `lib/services/products.ts`)
  — an optional per-product note like "pecho izquierdo, 8 cm", distinct
  from the logo's global catalog `notes`/`size`.
- **No migration**: `bom_json` is a straight passthrough of `BomItem[]`
  (`bom_json: input.bom` on write, `row.bom_json as BomItem[]` on read),
  so the field just rides along in the JSON.
- Edited in **Productos**: logo BOM rows render a placement text input
  (`components/admin/products-manager.tsx`).
- `lib/types.ts` `CartItem.bom` was widened (inline, to stay
  dependency-free) to carry the logo fields so the boards read them
  type-safely.

## 3. Uniform stage-board cards + expand chevron

`simple-stage-board.tsx` (Bordado/Empaque/Ploter) and
`impresion-board.tsx`:

- Item list caps at `MAX_VISIBLE_ITEMS = 4` rows with a `min-h-[160px]`
  floor → cards render at a consistent height instead of a long order
  towering over the grid.
- Orders with >4 lines show a `⌄ +N líneas más` toggle pinned at the
  card bottom (flips to `⌃ Ver menos`). Cards keep `items-start`, so
  expanding one card doesn't stretch its grid-row siblings.

## 4. In-house boards hide orders outsourced to an external station

Avoids double production: if an order is assigned to an **external
station** for a stage, the **in-house board for that same stage** drops
it (and it returns if the assignment is removed).

- Helper: `fetchOrdersOutsourcedToStage(supabase, orderIds, stage)` in
  `lib/services/station-assignments.ts` → `Set<orderUuid>` of orders
  assigned to a station whose `stage` matches.
- Applied on **all seven** board pages: `corte`, `maquila`, `impresion`,
  `bordado`, `empaque`, `ploter`, and `operador` (bodega — reuses the
  assignments it already loads, no extra query).
- `station_assignments.order_id` is the **order uuid** (orders PK), not
  the `ORDEN-NNNNN` ref. Admin can read the table via the migration-0012
  RLS policy.
- Assign / unassign / bulk-assign actions
  (`admin/station-users/actions.ts`) now revalidate **all** stage board
  paths (`STAGE_BOARD_PATHS`) so the change shows immediately.
- **Open edge case**: deactivating/deleting a station that has
  assignments doesn't immediately revalidate the boards (orders reappear
  on next load / manual refresh).

## 5. Ops fix done this session

- The recent `products.stages_json` column was erroring at runtime
  (`42703 … does not exist`) — the column existed; it was the **stale
  PostgREST schema cache** (the §8 gotcha in 0001). Fixed live with
  `notify pgrst, 'reload schema';` via the Supabase MCP. No migration.

---

## Verify

```bash
cd next-app && npx tsc --noEmit   # clean
```

Browser checks (need the admin session — `ulogisticcr@gmail.com`):
`/admin/bordado` + `/admin/impresion` show a **Logos** button per card
(hover a logo to enlarge); `/admin/maquila` no longer shows orders
assigned to external maquila stations.
