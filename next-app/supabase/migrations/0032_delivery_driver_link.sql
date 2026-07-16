-- A single shareable token the admin gives the driver. Opening
-- /d/<token> on a phone shows the day's delivery plan (read-only,
-- service-role read so the driver needs no login). Single row.
create table public.delivery_driver_link (
  id text primary key default 'default',
  token text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.delivery_driver_link enable row level security;
create policy "Authenticated manage driver link"
  on public.delivery_driver_link for all to authenticated
  using (true) with check (true);
