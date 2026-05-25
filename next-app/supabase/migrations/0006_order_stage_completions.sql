-- ─── Per-stage completion model ─────────────────────────────────────
-- The four operations boards (Bodega / Corte / Maquila / Impresión)
-- now run in parallel rather than as a linear pipeline driven by
-- orders.status. Each board sees every non-cancelled order from the
-- moment it's created, and each stage independently marks the order
-- as complete when their work is finished.
--
-- The /admin/orders board reads from this table to render the
-- per-order "Bodega ✓ · Corte ✓ · Maquila ◯ · Impresión ◯" strip.
--
-- We keep orders.status alongside this — it remains a useful meta
-- flag (pending / cancelled / completed) but no longer gates which
-- stage board an order appears on.

create table if not exists order_stage_completions (
    order_id     uuid not null references orders(id) on delete cascade,
    stage        text not null check (stage in ('bodega','corte','maquila','impresion')),
    completed_at timestamptz not null default now(),
    completed_by uuid references auth.users(id) on delete set null,
    notes        text,
    primary key (order_id, stage)
);

alter table order_stage_completions enable row level security;

create policy "Authenticated read order_stage_completions"
    on order_stage_completions for select
    to authenticated using (true);

create policy "Authenticated insert order_stage_completions"
    on order_stage_completions for insert
    to authenticated with check (true);

create policy "Authenticated update order_stage_completions"
    on order_stage_completions for update
    to authenticated using (true) with check (true);

create policy "Authenticated delete order_stage_completions"
    on order_stage_completions for delete
    to authenticated using (true);

create index if not exists idx_order_stage_completions_stage
    on order_stage_completions(stage);
