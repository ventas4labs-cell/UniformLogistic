---
name: Uniform Logistic
description: Costa Rican uniform manufacturing + order-to-delivery platform — a warm marketing world and a dense, orange-accented operations app.
colors:
  primary: "#EA580C"          # orange-600 — brand + primary CTA
  primary-deep: "#C2410C"     # orange-700 — hover/active
  primary-tint: "#FFF7ED"     # orange-50 — soft accent surface
  ink: "#16130F"              # near-black — marketing text/ground
  ivory: "#F7F4EE"            # warm paper — marketing background
  surface: "#FFFFFF"          # app light surface
  surface-dark: "#18181B"     # zinc-900 — app dark surface / cards
  bg-dark: "#0A0A0A"          # app dark background
  foreground: "#171717"       # app light text
  foreground-dark: "#F4F4F5" # app dark text
  neutral-line: "#E5E7EB"     # zinc-200 — hairline borders
  success: "#059669"          # emerald-600 — completed / done
  danger: "#DC2626"           # red-600 — cancel / error
  info: "#2563EB"             # blue-600 — pending / neutral status
typography:
  display:
    fontFamily: "TT Norms Pro Condensed, TT Norms Pro, -apple-system, Segoe UI, sans-serif"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  heading:
    fontFamily: "TT Norms Pro Condensed, TT Norms Pro, sans-serif"
    fontWeight: 800
    letterSpacing: "-0.01em"
  body:
    fontFamily: "TT Norms Pro, -apple-system, SF Pro Text, Inter, Segoe UI, sans-serif"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontWeight: 700
rounded:
  lg: "8px"
  xl: "12px"
  "2xl": "16px"
  "3xl": "24px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.xl}"
    padding: "14px 20px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
    textColor: "#FFFFFF"
  button-cta-marketing:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.full}"
    padding: "16px 32px"
  button-secondary:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.primary}"
    rounded: "{rounded.xl}"
    padding: "14px 20px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  badge-status:
    rounded: "{rounded.full}"
    padding: "2px 10px"
    typography: "{typography.mono}"
  input:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "12px"
---

# Uniform Logistic — Design System

## Overview

Uniform Logistic runs two deliberately distinct visual registers, matching its two audiences (see PRODUCT.md):

- **Marketing / public world** — landing, `/cotizar`, `/ordenar`, success. A warm "pattern-paper" ground: **ivory `#F7F4EE`** background, **ink `#16130F`** text, **orange** as the single accent. Type is set in the **condensed display** face, CTAs are **full-radius pills**, and layout breathes (generous whitespace, `max-w-6xl`). The job is to persuade and reassure a prospective buyer.
- **Operations app world** — the authenticated customer portal, admin, and shop-floor station boards. Neutral and dense: **white / zinc** surfaces with full **dark-mode** support (`.dark` class, user-toggleable), **orange** reserved for primary actions and brand moments, and a spectrum of status colors for production stages. The job is to let staff move fast and read state at a glance, including on phones/tablets on the floor.

Both worlds share one brand face (TT Norms Pro), one accent (orange-600), and one radius language. Keep the register consistent within a surface; don't bring pill CTAs and ivory grounds into the dense app, and don't bring zinc-gray density into the marketing pages.

## Colors

- **Orange `#EA580C` (primary)** is the brand and the primary action everywhere — CTAs, active states, focus rings (`focus:border-orange-500` / `ring-orange-500`), badges of note. Hover deepens to **`#C2410C`**. Use it sparingly in the app so it keeps meaning "act here / this is us."
- **Marketing ground:** ivory `#F7F4EE` background + ink `#16130F` text. Orange CTAs carry an orange glow shadow. This pairing is the public identity.
- **App surfaces:** white (light) / zinc-900 `#18181B` cards on zinc-950 `#0A0A0A` (dark). Semantic `--background`/`--foreground` swap by `.dark`. Hairlines are zinc-200 `#E5E7EB` (light) / zinc-800 (dark).
- **Status palette** (production stages + states): emerald = completed/done, blue = pending, red = cancelled/error, plus purple/yellow/orange/pink/indigo mapping to bodega/corte/maquila/impresión/empaque. These are functional, not decorative — don't recolor them for aesthetics.

## Typography

- **Display / headings** — **TT Norms Pro Condensed** (self-hosted woff2, weights 700/800/900), applied to `h1–h4` app-wide with `letter-spacing: -0.01em`. Big numbers and size labels also use the condensed face (`font-display`) at extrabold for gl: they must pop at a glance on the floor.
- **Body / UI** — **TT Norms Pro** (weights 400/500/700/800), `line-height: 1.6`. Falls back to SF → Inter → system so the layout never breaks if the woff2 fails.
- **Mono** — system mono stack, used bold for order/quote references and quantities (`ORDEN-00042`, `×4`).
- Weight is the primary hierarchy tool: extrabold (800) for headings and emphasis, bold (700) for labels/buttons, regular (400) for body. Avoid light weights.

## Layout

- Marketing centers on `max-w-6xl` (and `max-w-lg` for focused forms) with generous vertical rhythm.
- The app is full-width and dense, with sticky headers (`backdrop-blur`), filter popovers, and modal overlays rather than page navigations for secondary views (archives, requests, detail).
- **Mobile-first and touch-aware by design** (a hard constraint — station boards live on the floor): `@media (hover:none)` reveals hover-gated controls; `@media (pointer:coarse)` adds momentum scroll to wide tables/tab strips and `touch-action: manipulation` to kill tap delay; `data-device` hooks on `<html>` toggle phone/desktop-only elements. Wide tables scroll inside their own `overflow-x-auto` region.
- Grids collapse `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`; modals dock to the bottom on mobile (`rounded-t-2xl`) and center on desktop (`sm:rounded-2xl`).

## Elevation & Depth

- Soft, low shadows for app cards (`shadow-sm`), lifting to `shadow-lg` / `shadow-2xl` for modals and hovered cards.
- The marketing hero CTA carries a colored orange glow: `0 12px 32px -12px rgba(234,88,12,0.55)`.
- Overlays use `bg-black/40–50` + `backdrop-blur-sm`; sticky headers use a translucent ground (`bg-[#F7F4EE]/90` marketing, `/90` blur in app) so content reads through.
- Ambient depth on the login screen: slow GPU-only drifting background blobs (`drift-a…d`, 24–36s), disabled under `prefers-reduced-motion`.

## Shapes

- Radius language, small → large: `lg 8px` (inputs, small controls), `xl 12px` (buttons, form fields), `2xl 16px` (cards, panels, modals), `3xl 24px` (marketing feature cards / success panel), `full` (marketing CTAs, all status badges, swatch dots).
- Marketing CTAs are **pills** (`rounded-full`); app primary buttons are `rounded-xl`. Keep that distinction — it's part of how the two registers read differently.
- Color swatches and small indicators are perfect circles with a faint `border-black/10`.

## Components

- **Primary button** — orange-600 bg, white text, bold; `rounded-xl` in the app, **`rounded-full`** in marketing (ivory text, larger padding, glow). Hover → orange-700. Disabled → zinc-300, no color.
- **Secondary / ghost button** — white or transparent, orange or zinc text, matching radius; used for "Cambiar", "Volver", cancel.
- **Card** — `bg-white dark:bg-zinc-900`, `rounded-2xl`, `border-black/5` (or zinc-200/700), `p-4/5`. The universal app container.
- **Status badge** — `rounded-full`, small, `font-bold`, colored by state from the status palette, often with a count. Header action buttons carry a count badge in the same language (Solicitudes, Completados, Historial).
- **Input / textarea / select** — white, `rounded-xl`, `border-black/15`, `focus:border-orange-500` (no heavy focus ring in marketing; `ring-orange-500` in admin forms). Labels are `text-xs font-bold` uppercase-ish, muted.
- **Modal** — fixed overlay, backdrop-blur, `max-w-*`, docks bottom on mobile / centers on desktop, internal `overflow-y-auto`, an `X` close plus click-away.
- **Product / item card** — square image area (`object-contain` on a light ground so garments never crop), name, optional color-swatch row, an orange "Agregar" affordance.

## Do's and Don'ts

- **Do** keep orange rare and meaningful in the app — it signals "primary action" and brand. **Don't** paint whole app panels orange.
- **Do** honor the register of the surface: ivory/ink/pills for marketing, white/zinc/dense for the app. **Don't** blend them on one surface.
- **Do** carry state in the functional status colors (emerald/blue/red/stage hues). **Don't** repurpose those hues decoratively.
- **Do** design app controls for touch on the floor (comfortable targets, reveal hidden actions, scrollable wide tables). **Don't** rely on hover to expose a critical action.
- **Do** use weight (700/800) for hierarchy and the condensed face for headings/big numbers. **Don't** introduce new typefaces or light weights.
- **Do** show product images uncropped on a neutral ground. **Don't** `object-cover` garments.
- **Do** keep every string in Spanish (es-CR). **Don't** ship English UI copy.
