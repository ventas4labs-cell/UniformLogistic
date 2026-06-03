-- ─── Drop service / process labels from the materials inventory ────
-- The initial seed (0013) scooped every distinct name out of
-- products.bom_json, which included labor/service entries: "Servicio
-- Corte", "Servicio de Maquila", "Bordado", "Sublimación", "DTF",
-- etc. Those are production steps, not materials, so they don't
-- belong in the inventory.
--
-- This migration:
--  1. Deletes the existing service rows.
--  2. (Note for future seeds) — the BOM-seed in 0013 should filter
--     these out going forward; the WHERE clause in this migration
--     is the canonical exclusion list.

delete from materials
where (
       lower(trim(name)) like 'servicio %'
    or lower(trim(name)) like 'servicio_%'      -- "Servicio Corte" / "Servicio maquila1"
    or lower(trim(name)) in (
        'servicio',
        'servicio maquila',
        'servicio maquila1',
        'servicio corte',
        'servicio de bordado',
        'servicio de maquila',
        'servicio de sublimado',
        'corte',
        'bordado',
        'sublimación',
        'sublimacion',
        'sublimado',
        'dtf'
       )
);
