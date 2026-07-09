-- ─── 3D model → product link + custom-logo option ──────────────────
-- • three_d_models.product_id: link a model to a real product so a
--   design request can be turned into an order easily.
-- • three_d_models.allow_custom_logo: per-model switch letting the
--   customer upload their own artwork (jpg/png) for a zone.
-- • custom_design_requests product snapshot: capture the linked
--   product on the request so admin review is self-contained.
--   (custom_design_logos already supports custom logos via a null
--   logo_id + logo_image_url + logo_name.)

alter table three_d_models
    add column if not exists product_id uuid references products(id) on delete set null,
    add column if not exists allow_custom_logo boolean not null default true;

alter table custom_design_requests
    add column if not exists product_id uuid references products(id) on delete set null,
    add column if not exists product_code text,
    add column if not exists product_name text;
