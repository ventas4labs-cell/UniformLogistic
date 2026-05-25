-- ─── Partial dispatches from Empaque ────────────────────────────────
-- Empaque can dispatch an order in multiple shipments — e.g. ship
-- 15 of 30 polos today, the remaining 15 tomorrow. Each dispatch is
-- an immutable receipt with one row per dispatched line item.
--
-- Reads roll up per (order_id, order_item_id) so the empaque board
-- can show "ordered / dispatched / remaining" per line and the
-- order_stage_completions row for stage='empaque' can flip
-- automatically once remaining hits zero across every line.

create table if not exists order_dispatches (
    id              uuid primary key default gen_random_uuid(),
    order_id        uuid not null references orders(id) on delete cascade,
    dispatched_at   timestamptz not null default now(),
    dispatched_by   uuid references auth.users(id) on delete set null,
    notes           text
);

alter table order_dispatches enable row level security;
create policy "Authenticated read order_dispatches"
    on order_dispatches for select to authenticated using (true);
create policy "Authenticated insert order_dispatches"
    on order_dispatches for insert to authenticated with check (true);
create policy "Authenticated update order_dispatches"
    on order_dispatches for update to authenticated using (true) with check (true);
create policy "Authenticated delete order_dispatches"
    on order_dispatches for delete to authenticated using (true);

create index if not exists idx_order_dispatches_order
    on order_dispatches(order_id);

create table if not exists order_dispatch_items (
    dispatch_id   uuid not null references order_dispatches(id) on delete cascade,
    order_item_id uuid not null references order_items(id) on delete cascade,
    quantity      integer not null check (quantity > 0),
    primary key (dispatch_id, order_item_id)
);

alter table order_dispatch_items enable row level security;
create policy "Authenticated read order_dispatch_items"
    on order_dispatch_items for select to authenticated using (true);
create policy "Authenticated insert order_dispatch_items"
    on order_dispatch_items for insert to authenticated with check (true);
create policy "Authenticated update order_dispatch_items"
    on order_dispatch_items for update to authenticated using (true) with check (true);
create policy "Authenticated delete order_dispatch_items"
    on order_dispatch_items for delete to authenticated using (true);

create index if not exists idx_order_dispatch_items_order_item
    on order_dispatch_items(order_item_id);
