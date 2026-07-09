-- A product can now target several audiences (Hombre / Mujer / Unisex)
-- and hold multiple pictures per audience variant. The legacy single
-- `gender` and `image_url` columns are kept as the "primary" values so
-- every existing reader (catalog, PDF, orders, voice) keeps working;
-- the form writes both the primary and the new rich fields.
alter table public.products
  add column if not exists genders text[] not null default '{}',
  -- { "men": [url,…], "women": [url,…], "unisex": [url,…] }
  add column if not exists images_json jsonb not null default '{}'::jsonb;

-- Backfill the audience set from the single gender column.
update public.products
  set genders = array[gender]
  where cardinality(genders) = 0 and gender is not null;

-- Seed the per-audience galleries with the existing primary image so
-- edit screens show it under the right bucket.
update public.products
  set images_json = jsonb_build_object(gender, jsonb_build_array(image_url))
  where images_json = '{}'::jsonb
    and image_url is not null
    and gender is not null;
