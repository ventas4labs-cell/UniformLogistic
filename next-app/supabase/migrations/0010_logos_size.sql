-- ─── Logo physical size ──────────────────────────────────────────────
-- Embroidered and printed logos are quoted/produced at a specific
-- size. Free-text rather than numeric width+height because shops use
-- mixed conventions: "10 × 6 cm", "3\" diámetro", "8 cm ancho", etc.

alter table logos
    add column if not exists size text;
