-- Free-text category (e.g. POLO, TSHIRT, JERSEY) derived from the
-- uploaded image filename's first word. Distinct from product_type,
-- which stays the coarse Camisa/Pantalón/Otro grouping. Idempotent.
alter table public.catalog_items
    add column if not exists category text not null default '';
