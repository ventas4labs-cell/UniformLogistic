-- Delivery module: a courier plans + executes deliveries of dispatched
-- orders. One row per order; state is derived — unscheduled (no date),
-- scheduled (scheduled_date set, not delivered), delivered (delivered_at).
create table public.order_deliveries (
  order_id uuid primary key references public.orders(id) on delete cascade,
  scheduled_date date,
  scheduled_by uuid references auth.users(id) on delete set null,
  scheduled_at timestamptz,
  -- when the customer was emailed that their order is out for delivery
  notified_at timestamptz,
  delivered_by uuid references auth.users(id) on delete set null,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_deliveries_scheduled_date_idx
  on public.order_deliveries(scheduled_date);

alter table public.order_deliveries enable row level security;
create policy "Authenticated read order_deliveries"
  on public.order_deliveries for select to authenticated using (true);
create policy "Authenticated insert order_deliveries"
  on public.order_deliveries for insert to authenticated with check (true);
create policy "Authenticated update order_deliveries"
  on public.order_deliveries for update to authenticated using (true) with check (true);
create policy "Authenticated delete order_deliveries"
  on public.order_deliveries for delete to authenticated using (true);
