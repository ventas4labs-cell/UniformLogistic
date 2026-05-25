-- ─── Additional parallel stages ──────────────────────────────────────
-- The operations pipeline grows from 4 boards (Bodega / Corte / Maquila
-- / Impresión) to 7 by adding Bordado, Empaque and Ploter. Same rules
-- apply: every order is visible on every board from the moment it's
-- created, and each board marks completion independently.
--
-- order_stage_completions.stage is constrained by a CHECK — Postgres
-- doesn't allow editing a CHECK in place, so we drop the old one and
-- add a wider one. The constraint name comes from the auto-generated
-- name in 0006; if that name has drifted in a particular environment,
-- look it up with \d+ order_stage_completions.

alter table order_stage_completions
    drop constraint if exists order_stage_completions_stage_check;

alter table order_stage_completions
    add constraint order_stage_completions_stage_check
    check (stage in ('bodega','corte','maquila','impresion','bordado','empaque','ploter'));
