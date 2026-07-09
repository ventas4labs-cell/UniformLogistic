-- ─── Basic (default) products + design-request size lines ───────────
-- • products.is_basic: marks a product as a shared "basic" item shown to
--   every empresa (not gated by company_products). Basic items carry a
--   linked 3D model and go through the sizes → 3D-logo → order-request
--   flow instead of a direct cart order.
-- • custom_design_requests.items: the per-size quantities the customer
--   chose, so accepting the request can build a real order.

alter table products
    add column if not exists is_basic boolean not null default false;

create index if not exists idx_products_is_basic on products(is_basic) where is_basic;

alter table custom_design_requests
    add column if not exists items jsonb not null default '[]'::jsonb;
