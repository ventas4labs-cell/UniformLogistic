---
target: /app/admin (shell + home + Corte board)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-04T18-28-24Z
slug: next-app-app-admin-admin
---
Method: dual-agent (A: design review · B: detector + browser)
Scope: admin shell + home dashboard + representative Corte board. Browser evidence unavailable — the dev server on :3000 is serving an unrelated app ("4labs Solutions"), so /admin/home 404s. Source + detector review.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | In-board feedback is strong; the shell shows zero current-location — you must open the launcher to see where you are. |
| 2 | Match System / Real World | 4 | Stage names, pzas/líneas, fabric-vs-BOM, es-CR voseo. Speaks the shop floor's language. |
| 3 | User Control and Freedom | 3 | Escape/outside-click close launcher, form cancels exist; stage-complete toggle looks optimistic with no visible undo. |
| 4 | Consistency and Standards | 2 | gray-* mixed with zinc-*; text-green-600 vs the emerald token; role="menu" without menu keyboard semantics. |
| 5 | Error Prevention | 2 | Stage-complete toggle with no confirmation on a touch surface; 28px pin buttons overlap the tile's primary action. |
| 6 | Recognition Rather Than Recall | 3 | Icons+labels everywhere, but launcher-only nav forces recall of which group a module is in and to open the launcher to see location. |
| 7 | Flexibility and Efficiency | 3 | Pinnable fast actions + in-place quick-create are strong; but default nav is 2 interactions/hop, no keyboard nav in the launcher, no command palette. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean and dense, but home stacks 19 quick-action tiles + 3 stat rows + a 7-cell stage grid; launcher renders 22 modules at once. |
| 9 | Error Recovery | 3 | Inline red errors, disabled/saving states where forms exist. |
| 10 | Help and Documentation | 1 | Effectively none — one 11px hint line for a 22-module tool with subcontractor invoicing and fabric variance. |
| **Total** | | **27/40** | **Acceptable (top edge)** |

## Design Specificity Verdict

**High specificity — this could not be lifted onto another business without gutting it.** The authorship is in the data model surfacing as glanceable UI, not decoration: Corte/Maquila/Bordado/Impresión/Ploter/Empaque/Bodega/Entregas as first-class stage boards; pzas vs líneas; fabric-vs-BOM variance (CorteFabricReportPanel); external corte-station assignment with HardHat badges + a "Facturas a pagar" module (the CR maquila subcontracting pattern); es-CR voseo in live copy ("fijá las que querés"). Correct functional stage-hue usage (Corte Scissors icon yellow-600 matching DESIGN.md).

The app-launcher-only navigation (Workspace-style dot-grid, no sidebar) is an opinionated, authored choice that buys full page width for 22 dense modules — but it optimizes the *page*, not *movement between pages*, and that trade is felt.

**Deterministic scan:** detector ran clean (exit 2 = findings). 2 findings, both the same physical spot — `gray-on-color` at `admin-menu.tsx:204` (text-gray-700 / text-zinc-300 co-located with bg-orange-50 on the launcher tile hover state). Low-risk (text-gray-700 on bg-orange-50 is acceptable; the zinc-300 dark class wouldn't apply on that light ground) — one spot to glance at, not a blocker. No es-CR false positives. The other 5 files scanned clean, which corroborates that the drift the design review found (gray/zinc, green/emerald) is a *token-choice* consistency issue, not a contrast-failure issue.

**Visual overlays:** none — the target could not be loaded in a browser (unrelated app on :3000). No user-visible overlay available.

## Overall Impression

This is a genuinely well-authored operations app for a specific manufacturer, and its density mandate is executed correctly *inside* each screen. The single biggest opportunity is the opposite of the screens: the **journey between them**. A launcher-only nav with no persistent orientation taxes every hop for a daily power user, and it wears a `role="menu"` ARIA contract it doesn't honor. Fix orientation + the menu semantics and this jumps from "Acceptable" to "Good."

## What's Working

1. **The data model surfaces as glanceable UI, not forms.** Corte cards pill-summarize pzas/líneas/+N extra/external-station/fabric-vs-BOM in one row — a cutter reads the whole order state at a glance. The density mandate, executed correctly.
2. **Home's stage-workload grid is the right abstraction, colored functionally.** Per-stage pending counts flip green at zero and deep-link to /admin/<stage> — it answers "where's the fire" in one look.
3. **Configurable pinned fast actions + in-place quick-create is a real efficiency layer.** Pins persist to a cookie the server reads on next paint (no flash); quick-create opens a modal over the current page instead of navigating away. The launcher-only model's escape hatch, well built.

## Priority Issues

**[P1] Launcher wears `role="menu"` but doesn't honor the ARIA menu contract.** `admin-menu.tsx:108-144` sets role="menu"/menuitem but implements only Escape — no roving tabindex, no arrow keys, focus never moves into the panel on open.
- Why it matters: this is the *only* navigation in the app. A false ARIA contract is worse than none — AT announces "menu" and users expect arrow keys that don't work.
- Fix: implement real menu semantics (focus first item on open, arrow/Home/End roving, Tab to exit) OR drop role="menu"/menuitem, treat it as a `<nav>` disclosure with a labeled region, and move focus to the panel heading on open.

**[P1] No global orientation; launcher-only nav taxes every hop.** The shell (`admin-shell.tsx:22-28`) shows logo + static "Uniform Logistic" wordmark + fast actions — no current-module name, no breadcrumb, no home crumb. Current location is only the orange tile *inside the closed launcher*.
- Why it matters: for daily use across 22 modules, every navigation is open→scan-22→click, and you can't tell where you are without reopening. Density won the page but lost the journey.
- Fix: put the active module's label (from ADMIN_MODULES by pathname) in the top bar as a home link; add a keyboard shortcut to open the launcher and a type-to-filter field at its top.

**[P2] Token drift is visible — two "success" greens, gray vs zinc neutrals.** Home renders the stage-grid zero-state in `text-green-600` (#16A34A, home/page.tsx:170) while the "Completados" StatCard uses `emerald` (#059669, line 250) — both mean "done," same viewport, perceptibly different hues. gray-* mixes with zinc-* across shell/home/menu. DESIGN.md commits to emerald + the zinc scale and calls status colors "functional, not decorative."
- Why it matters: two success signals in two shades reads as "these mean different things" to a careful operator — noise in a functional palette.
- Fix: replace green-* with emerald-* app-wide; sweep gray-* → zinc-* in shell/home/menu.

**[P2] Touch targets under the 44px DESIGN mandate on a phone/tablet surface.** Pin buttons w-7 h-7 = 28px overlapping the tile's primary action (quick-actions-panel.tsx:116); board refresh p-2+18px ≈ 34px (corte-board.tsx:400-407); assignment/filter tabs py-1.5 ≈ 30px. DESIGN.md explicitly requires ≥44px because these boards run on the floor.
- Why it matters: a bodega worker on a mounted tablet mis-taps the 28px pin instead of opening the tile, or fat-fingers the filter tabs.
- Fix: raise interactive controls to 44px min; separate the pin affordance from the tile hit area (e.g. a customize mode rather than an always-on overlay).

**[P3] Big numbers miss the condensed-numeral spec; KPI deep links drop intent.** DESIGN.md says big numbers use font-display (Condensed) extrabold "so they pop at a glance on the floor," but home's KPI/stage numbers are font-extrabold *without* font-display. Separately, three of four order KPIs ("Completados/Cancelados/Total") all link to bare /admin/orders with no pre-filter.
- Fix: apply font-display to dashboard numerals; carry a ?status= filter on the KPI hrefs.

## Persona Red Flags

**Alex (power user):** The launcher-only default is his tax — every hop is open→scan-22→click with no keyboard path inside the launcher (only Escape; no arrows, no type-to-jump, no command palette). His only relief, pinning, uses a 28px overlay target. No shortcut to even open the launcher.

**Sam (accessibility):** role="menu" with no keyboard menu behavior and no focus-move-on-open (admin-menu.tsx:108); 11px uppercase gray-400/500 labels are small and low-contrast; the amber focus ring on extra-form inputs departs from the mandated orange ring. Positive: stage counts don't rely on color alone (0 vs N carries meaning), so green-vs-orange survives deuteranopia.

**Shop-floor / bodega worker on a phone (project-specific):** (1) the dot-grid "this is a menu" hint appears only on hover (admin-menu.tsx:91-103) — on touch they see just a logo and may never discover it's the *only* nav. (2) Sub-44px filter tabs, refresh, pins. (3) Boards have no live refresh — router.refresh() is a manual button; on a parallel floor a picker can act on stale state. (4) 11px uppercase stage labels are hard to read at arm's length on a station-mounted tablet.

## Minor Observations

- "Principal" bundles 14 unlike modules (catalog, finance, 3D models, station config) under one header — wants sub-grouping (Catálogo / Finanzas / Configuración).
- "Facturas a pagar" appears three times on home (KPI card + quick-action tile + badge) — redundant.
- Corte cards collapse to a single tall column on phones; each card is heavy → long scroll to find one order. A collapsed/summary card state would help.
- The extra-form's amber "out-of-plan addition" color is arguably intentional, not drift.

## Questions to Consider

1. If the launcher is the *only* navigation and closed by default, why does the top bar spend prime real estate on a static "Uniform Logistic" wordmark instead of the current module name + a home crumb?
2. On a parallel shop floor where multiple stages act on the same order at once, is a manual RefreshCw acceptable — or does the absence of live/polling state cause double-work and false "done" signals?
3. You reserve orange to mean "act here," yet home paints 19 tiles with orange icon chips and the one true primary ("Nuevo pedido") is *also* orange — has the accent already lost its meaning on the first screen a user sees?
