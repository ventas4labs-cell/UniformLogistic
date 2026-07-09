-- Missing-insumo reports gain a purchase → receive lifecycle.
-- open      : raised by a board, waiting for admin to buy
-- purchased : admin bought it; the raising board now waits for physical
--             receipt
-- received  : the raising board confirmed the insumo arrived → closed
-- `stage` records which board raised the report so the receive action
-- can be surfaced back on that board. The legacy `resolved` boolean is
-- kept in sync (resolved = status 'received') so older reads keep working.
alter table public.missing_insumo_reports
  add column if not exists status text not null default 'open',
  add column if not exists stage text,
  add column if not exists purchased_at timestamptz,
  add column if not exists purchased_by uuid references auth.users(id) on delete set null,
  add column if not exists received_at timestamptz,
  add column if not exists received_by uuid references auth.users(id) on delete set null;

alter table public.missing_insumo_reports
  drop constraint if exists missing_insumo_reports_status_check;
alter table public.missing_insumo_reports
  add constraint missing_insumo_reports_status_check
  check (status in ('open', 'purchased', 'received'));

-- Backfill lifecycle from the legacy resolved flag (one-time; the guard
-- keeps it a no-op if the migration is ever replayed).
update public.missing_insumo_reports
  set status = case when resolved then 'received' else 'open' end,
      received_at = case when resolved then coalesce(resolved_at, now()) else null end
  where status = 'open';

create index if not exists missing_insumo_reports_status_idx
  on public.missing_insumo_reports(status);
