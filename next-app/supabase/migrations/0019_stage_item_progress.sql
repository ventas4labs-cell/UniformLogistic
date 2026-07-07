-- ─── Per-item partial progress for a stage ──────────────────────────
-- Some stages (starting with Bordado) don't finish a whole order in one
-- go — the operator completes a subset of the pieces and needs to record
-- "how many are done so far" per line. This table holds that partial
-- count per (stage, order_item). When every line of an order reaches its
-- full quantity, the app also writes the binary order_stage_completions
-- row so the existing done/pending tabs and /admin/orders strip stay
-- accurate. Undoing completion leaves the partial counts intact.

create table if not exists order_stage_item_progress (
    order_id      uuid not null references orders(id) on delete cascade,
    stage         text not null,
    order_item_id uuid not null references order_items(id) on delete cascade,
    qty_done      integer not null default 0 check (qty_done >= 0),
    updated_at    timestamptz not null default now(),
    updated_by    uuid references auth.users(id) on delete set null,
    primary key (stage, order_item_id)
);

alter table order_stage_item_progress enable row level security;

-- Mirror order_stage_completions: any authenticated user may read/write.
-- The server actions re-check the caller is admin (or the assigned
-- station for that stage/order) before mutating.
create policy "Authenticated read order_stage_item_progress"
    on order_stage_item_progress for select
    to authenticated using (true);

create policy "Authenticated insert order_stage_item_progress"
    on order_stage_item_progress for insert
    to authenticated with check (true);

create policy "Authenticated update order_stage_item_progress"
    on order_stage_item_progress for update
    to authenticated using (true) with check (true);

create policy "Authenticated delete order_stage_item_progress"
    on order_stage_item_progress for delete
    to authenticated using (true);

create index if not exists idx_stage_item_progress_stage
    on order_stage_item_progress(stage);

create index if not exists idx_stage_item_progress_order
    on order_stage_item_progress(order_id, stage);
