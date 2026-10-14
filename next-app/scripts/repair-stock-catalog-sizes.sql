-- Idempotent catalog-data repair for the stock size omissions reported in October 2026.
-- Preserve every existing size and every other sizes_json field. No stock balances change.
with required_sizes as (
    select id, 'men'::text as audience, 'XL'::text as size
    from public.products
    where name ilike '%capa%' and name ilike '%moto%'
    union all
    select id, 'men', 'UNITALLA'
    from public.products
    where name ilike '%chaleco%' and name ~* '\mATO\M'
    union all
    select id, 'women', 'XL'
    from public.products
    where name ilike '%polo%'
      and jsonb_array_length(coalesce(sizes_json->'women', '[]'::jsonb)) > 0
      and coalesce(sizes_json->'men', '[]'::jsonb) @> '["XL"]'::jsonb
)
update public.products p
set sizes_json = jsonb_set(
    coalesce(p.sizes_json, '{}'::jsonb),
    array[r.audience],
    coalesce(p.sizes_json->r.audience, '[]'::jsonb) || jsonb_build_array(r.size)
)
from required_sizes r
where p.id = r.id
  and not coalesce(p.sizes_json->r.audience, '[]'::jsonb) @> jsonb_build_array(r.size)
returning p.product_code, p.name, p.sizes_json;
