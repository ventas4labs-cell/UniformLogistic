-- ─── Corte fabric consumption report ────────────────────────────────
-- The corte agent reports how much fabric each order actually consumed.
-- One row per (order, tela): an order cut from two telas gets two rows.
-- `expected_qty` is a snapshot of what the product BOM predicted at the
-- moment of reporting, so the variance stays meaningful even if a
-- product's BOM is edited later. Null when the BOM has no fabric line
-- we can attribute to that tela.

create table if not exists order_corte_fabric (
    id           uuid primary key default gen_random_uuid(),
    order_id     uuid not null references orders(id) on delete cascade,
    -- Tela as it appears on the order line (products.fabric_type).
    -- Empty string is the "sin tela especificada" bucket, kept as ''
    -- rather than null so the unique index below still applies.
    fabric_type  text not null default '',
    -- Metros (or whatever `unit` says) actually spent.
    qty_used     numeric(12, 2) not null check (qty_used >= 0),
    unit         text not null default 'm',
    -- BOM estimate at report time. Null = not derivable.
    expected_qty numeric(12, 2),
    notes        text,
    reported_by  uuid references auth.users(id) on delete set null,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- One report line per tela per order — re-reporting overwrites.
create unique index if not exists idx_corte_fabric_order_tela
    on order_corte_fabric(order_id, fabric_type);

create index if not exists idx_corte_fabric_order
    on order_corte_fabric(order_id);

alter table order_corte_fabric enable row level security;

-- Mirrors order_stage_item_progress: any authenticated user may
-- read/write at the DB level; the server action re-checks the caller is
-- admin or the corte station assigned to that order before mutating.
create policy "Authenticated read order_corte_fabric"
    on order_corte_fabric for select
    to authenticated using (true);

create policy "Authenticated insert order_corte_fabric"
    on order_corte_fabric for insert
    to authenticated with check (true);

create policy "Authenticated update order_corte_fabric"
    on order_corte_fabric for update
    to authenticated using (true) with check (true);

create policy "Authenticated delete order_corte_fabric"
    on order_corte_fabric for delete
    to authenticated using (true);
