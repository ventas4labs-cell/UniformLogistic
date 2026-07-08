-- Customer-facing quote configurator.
--
-- Extends the catalog + quote tables so a public visitor can configure
-- an item (choose fabric, choose color, add logos) and the price
-- updates live. Pricing model: base unit_price + price_per_logo per
-- applied logo; fabric and color are spec choices that don't move the
-- price. Idempotent so it can be applied on top of the MCP-created
-- base tables via `supabase db push`, the dashboard SQL editor, or the
-- Supabase MCP connector once reconnected.

-- ── catalog_items: selectable options + per-logo price ──────────────
alter table public.catalog_items
    add column if not exists fabric_options jsonb not null default '[]'::jsonb;
alter table public.catalog_items
    add column if not exists color_options jsonb not null default '[]'::jsonb;
alter table public.catalog_items
    add column if not exists price_per_logo numeric(12,2) not null default 0;

-- Seed fabric_options from the single fabric_type so pre-existing items
-- offer at least their current fabric in the configurator.
update public.catalog_items
   set fabric_options = jsonb_build_array(fabric_type)
 where fabric_type is not null
   and fabric_type <> ''
   and fabric_options = '[]'::jsonb;

-- ── quotes: distinguish customer-submitted leads from admin drafts ──
alter table public.quotes
    add column if not exists source text not null default 'admin';

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'quotes_source_check'
    ) then
        alter table public.quotes
            add constraint quotes_source_check
            check (source in ('admin', 'customer'));
    end if;
end $$;

-- ── quote_items: capture the chosen color + the per-logo price ──────
alter table public.quote_items
    add column if not exists color text;
alter table public.quote_items
    add column if not exists price_per_logo numeric(12,2) not null default 0;
