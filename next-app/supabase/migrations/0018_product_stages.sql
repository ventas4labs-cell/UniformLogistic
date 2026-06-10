-- ─── Per-product production stages ──────────────────────────────────
-- A product now declares which operations stages it actually needs
-- (corte / maquila / impresion / bordado / empaque / ploter / bodega).
-- Stage boards only show orders that contain at least one item whose
-- product requires that stage, so an order never lands on a board that
-- has nothing to do for it.
--
-- NULL or empty means "all stages" — existing products keep showing on
-- every board until the admin narrows them down, so behaviour is
-- unchanged on rollout.

alter table products
    add column if not exists stages_json jsonb;
