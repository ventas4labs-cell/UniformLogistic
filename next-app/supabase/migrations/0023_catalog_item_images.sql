-- Multiple images per catalog item, each tagged with the color it
-- depicts (parsed from the "TIPO COLOR" filename). Lets the customer
-- configurator swap the shown image when a color is selected. The
-- existing image_url stays as the card thumbnail / primary image.
-- Idempotent.
alter table public.catalog_items
    add column if not exists images jsonb not null default '[]'::jsonb;

-- Backfill: existing single image becomes the first (untagged) gallery
-- entry so nothing shows a blank gallery after the upgrade.
update public.catalog_items
   set images = jsonb_build_array(jsonb_build_object('url', image_url, 'color', ''))
 where image_url is not null
   and image_url <> ''
   and images = '[]'::jsonb;
