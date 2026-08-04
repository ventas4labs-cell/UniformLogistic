# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary audiences, each owning different surfaces:

- **Internal ops / admin team** — run the business day-to-day: create products and orders, move each order through production, manage stock, invoicing, and deliveries. They work in the admin app and on per-stage production boards, often on the shop floor. *Design priority on admin surfaces: their speed and information density win.*
- **Empresa (client company) customers** — B2B buyers who browse the catalog, request quotes, place and track orders through their company portal. They reach the app via a no-password link. *Design priority on customer/public surfaces (portal, cotizar, fast order): their clarity and trust win.*

Secondary: **production-station / maquila workers** (internal and outsourced) who update stage progress on shared boards via station links; and **prospects** who arrive at public entry points (quote, fast order) before becoming customers.

## Product Purpose

Run a Costa Rican uniform manufacturer end to end in one system: from a customer's order, through in-house production (cut, sew, embroider, print), to dispatch or company stock and final delivery — while giving client companies self-service ways to order and track. It exists to replace scattered manual coordination (spreadsheets, chats, paper) with a single source of truth shared by the workshop and the client. Success = an order placed by a company flows to the floor, through every stage, and out to delivery without anyone losing the thread.

## Positioning

Differentiators a neighboring product could not truthfully copy:

- **All manufacturing under one roof in Costa Rica** — cutting, sewing, embroidery, and printing are done locally and controlled directly, enabling faster turnaround (weeks, not months).
- **One order tracked from placement through every production stage to delivery** — a single system makes each order's progress visible to both staff and the client, rather than living in disconnected tools.
- **Self-service customer portal** — per-company no-password links, an online catalog, quotes, 3D custom logo placement, and fast orders let clients transact without a manual back-and-forth.

## Operating Context

- **Order intake:** authenticated empresa catalog → cart → checkout; public quote configurator (`/cotizar`); public fast order (`/ordenar`) that lands as a *solicitud* for admin review before becoming a real order.
- **Production flow:** an order moves through stages — bodega, corte, maquila/costura, bordado, impresión, empaque — each with its own board; some stages are outsourced to external stations/maquilas. Then the order is dispatched to the customer and/or moved into the company's stock, and finally delivered (courier planning + driver link).
- **Admin management:** products (with BOM/insumos, per-size overrides, sizes, colors, 3D models), companies, logos, invoices, stock, deliveries, and incoming fast-order requests.
- **Access model:** empresa customers, production stations, and drivers reach their views through no-password token links (`/o/…`, `/s/…`, `/d/…`); admin is gated to a fixed account.
- **Environment:** Spanish (es-CR) throughout; Costa Rica business reality (tax, invoicing, delivery). Production boards are used on phones and tablets on the shop floor.

## Capabilities and Constraints

- **Stack (existing):** Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4; Supabase (Postgres, Auth, Storage, RLS) as the backend; deployed on Vercel; transactional email via Resend (verified domain `uniformlogisticcr.com`).
- **Costa Rica compliance:** CABYS tax codes on products, company document number (cédula), IVA, and a local delivery workflow are built in.
- **Domain rules:** order line sizes carry a gender prefix (Hombre/Mujer) plus size; products carry a BOM of insumos with optional per-size consumption overrides; "basic" products are shown to every company, while other products are scoped per company.
- **Terminology (must stay consistent):** *pedido* (order), *solicitud* (request / fast order), *cotización* (quote), *empresa* (client company), *insumo* (BOM material), *tela* (fabric), *estación* / *maquila* (production station), and the stage names *corte*, *bordado*, *impresión*, *empaque*.

## Brand Commitments

- Name: **Uniform Logistic** (`uniformlogisticcr.com`).
- **Orange** brand color and the **UL** logo (`next-app/public/ul-logo.png`) are the identity.
- **Spanish (es-CR)** is the product voice everywhere — user-confirmed binding.
- **No-password token-link access** for empresas, stations, and drivers is a product commitment, not just an implementation detail — keep entry frictionless.

## Evidence on Hand

- A real, running production application (this repo, `next-app/`) live on Vercel, backed by real order/company/product data in Supabase.
- No testimonials, customer names, pricing tiers, benchmarks, or licensing claims have been established. Future work must not fabricate them.

## Product Principles

1. **Two audiences, two priorities.** Admin/ops surfaces optimize for the internal team's speed and density; customer-facing surfaces optimize for clarity and trust.
2. **One order, tracked end to end.** Every order stays visible from placement through each production stage to delivery — never lose the thread.
3. **Frictionless access.** Customers and stations get in through no-password token links; keep entry effortless.
4. **Built for the shop floor.** Production boards must stay touch-friendly and glanceable on phones/tablets in a working environment.
5. **Local by default.** Spanish (es-CR) and Costa Rica business/tax reality are first-class, never afterthoughts.

## Accessibility & Inclusion

Shop-floor mobile/touch use is a known, required condition: station boards (corte, bordado, maquila, empaque) run on phones and tablets and must remain touch-friendly. Interface is Spanish-first.
