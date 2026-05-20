# F5 follow-ups

Not blockers — small items left after the F5 batch because the macOS
sandbox revoked Bash/Read mid-session, so I couldn't `git add`/`tsc`/`git
commit` from inside this session.

## Already complete on disk

- Migration `0004_facturacion_inbound.sql` (applied to Supabase live).
- `lib/facturacion/services/xml-parser-service.ts` (inbound parser).
- `app/api/admin/facturacion/recibidas/route.ts` (GET list, POST upload).
- `app/api/admin/facturacion/recibidas/[id]/respond/route.ts` (emit MR-10).
- `app/api/cron/facturacion/refresh-resumen/route.ts` (nightly D-104).

## Manual follow-ups needed

1. **Edit `next-app/vercel.json`** — add the new cron entry:

   ```json
   {
     "path": "/api/cron/facturacion/refresh-resumen",
     "schedule": "0 3 * * *"
   }
   ```

   alongside the existing `poll` (`*/3 * * * *`) and `retry-queue`
   (`*/15 * * * *`) entries.

2. **Run `npx tsc --noEmit`** from `next-app/` to verify the F1–F5
   additions compile cleanly. Pattern-wise the new files mirror existing
   working routes; expected to pass.

3. **Commit + push**. Suggested message structure:

   ```
   Facturación module phases F1–F5

   F1: public /api/admin/facturacion/emit + invoices linkage
   F2: Nota Crédito (03) template + nota route + server action
   F3: polling + retry crons + admin documents board with consultar /
       reenviar / anular actions
   F4: jspdf representación gráfica + PDF download route + Resend email
       delivery stub
   F5: migration 0004 (fe_facturas_recibidas + fe_lineas_recibidas +
       fe_receptores + fe_resumen_fiscal + refresh_resumen_fiscal RPC),
       inbound XML parser, recibidas list/upload + MR-10 ACK route,
       refresh-resumen cron
   ```
