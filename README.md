# Uniform Logistic

B2B uniform ordering platform for Costa Rica — built with Next.js 16 (App
Router) + Supabase. Companies get a per-empresa catalog of uniforms; the
admin manages stock, production, despacho, and electronic invoicing
(Hacienda v4.4) from a single dashboard.

The whole application lives in [`next-app/`](./next-app). The repo root
only holds top-level docs and CI plumbing.

## Quick start

```bash
cd next-app
npm install
cp .env.example .env.local      # fill in Supabase + Anthropic + OpenAI keys
npm run dev
```

The dev server runs on http://localhost:3001.

## Tech stack

- **Next.js 16** App Router (Turbopack dev + build)
- **React 19**
- **Tailwind CSS v4** with class-based dark mode
- **TT Norms Pro** + **TT Norms Pro Condensed** as the brand typography
  (self-hosted from `next-app/public/fonts/`)
- **Supabase** (Postgres + Auth + Storage + RLS)
- **@anthropic-ai/sdk** for voice-dictation parsing
- **OpenAI Whisper API** as the cross-browser STT fallback
- **jspdf + jspdf-autotable** for PDF "representación gráfica"
- **xml-crypto + node-forge + @xmldom/xmldom** for XAdES-EPES signing of
  Hacienda electronic invoices (v4.4 schemas)

## Repo layout

```
.
├── next-app/                      The application (everything lives here)
│   ├── app/                       App Router routes
│   │   ├── (admin)/admin/         Admin dashboard
│   │   ├── (app)/                 Customer-facing pages
│   │   ├── api/admin/             Admin API endpoints
│   │   └── api/cron/              Vercel cron entry points
│   ├── components/
│   ├── lib/
│   │   ├── facturacion/           Hacienda v4.4 e-invoicing module
│   │   ├── services/              Domain services (orders, invoices, ...)
│   │   └── hooks/                 Client-side hooks (useDictation, ...)
│   ├── public/fonts/              Self-hosted TT Norms Pro woff2 files
│   ├── supabase/migrations/       Versioned DB migrations
│   └── package.json
├── PRODUCT_STOCK_DICTATION.md     Voice-dictation feature spec
├── .gitignore
└── README.md                      (this file)
```

## Deployment

The Vercel project is configured to deploy from `next-app/` as its root
directory. A push to `main` triggers a production build at
https://uniform-logistic-ordering.vercel.app.

Three Vercel crons run on production (configured in
[`next-app/vercel.json`](./next-app/vercel.json)):

- `/api/cron/facturacion/poll` every 3 min — resolves `procesando`
  documents that didn't get a verdict from Hacienda in-process.
- `/api/cron/facturacion/retry-queue` every 15 min — re-sends documents
  whose initial /recepcion POST failed.
- `/api/cron/facturacion/refresh-resumen` daily at 3:00 — recomputes
  monthly D-104 IVA summaries.

Set `CRON_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`RESEND_API_KEY`, and `RESEND_FROM_ADDRESS` in the Vercel project's
environment variables.

## Documentation

- [`PRODUCT_STOCK_DICTATION.md`](./PRODUCT_STOCK_DICTATION.md) — voice
  dictation feature spec (stock movements + product creation).
- [`next-app/CLAUDE.md`](./next-app/CLAUDE.md) — agent instructions.
- [`next-app/AGENTS.md`](./next-app/AGENTS.md) — notes on the Next.js 16
  conventions used here.

## License

Proprietary. © Uniform Logistic CR.
