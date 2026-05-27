-- ─── Per-(order, insumo) prep tracking ──────────────────────────────
-- Bodega operator preps insumos for a given order. Each insumo line
-- shows how much is required (computed from order qty × BOM); this
-- table stores how much has been prepared so far so the UI can show
-- "Total 217 · Preparado 100 · Faltan 117".
--
-- Separate from insumo_completions on purpose: completion is a
-- discrete boolean (operator clicks the green check when this insumo
-- is done), prep is a continuous quantity the operator types as they
-- pull rolls/boxes from stock.

create table if not exists insumo_preparations (
    order_id     uuid not null references orders(id) on delete cascade,
    insumo_name  text not null,
    prepared_qty numeric not null default 0 check (prepared_qty >= 0),
    updated_at   timestamptz not null default now(),
    updated_by   uuid references auth.users(id) on delete set null,
    primary key (order_id, insumo_name)
);

alter table insumo_preparations enable row level security;

create policy "Authenticated read insumo_preparations"
    on insumo_preparations for select
    to authenticated using (true);

create policy "Authenticated insert insumo_preparations"
    on insumo_preparations for insert
    to authenticated with check (true);

create policy "Authenticated update insumo_preparations"
    on insumo_preparations for update
    to authenticated using (true) with check (true);

create policy "Authenticated delete insumo_preparations"
    on insumo_preparations for delete
    to authenticated using (true);

create index if not exists idx_insumo_preparations_order
    on insumo_preparations(order_id);
