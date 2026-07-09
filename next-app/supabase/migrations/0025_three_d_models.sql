-- ─── 3D Models + Custom Order (design requests) ─────────────────────
-- Admin uploads web-optimized .glb shirt models (via `npm run sync:3d`),
-- defines preset logo-placement "zones" on each, and assigns which
-- empresas can see which model. A company customer (signed in through
-- their /o/<token> link) opens /custom-order, recolors the model, drops
-- their company logos onto the enabled zones, and submits a DESIGN
-- REQUEST the admin reviews. This is not a production order — pricing is
-- bespoke and orders have no placement fields today.

-- ── Master model catalog ────────────────────────────────────────────
create table if not exists three_d_models (
    id                   uuid primary key default gen_random_uuid(),
    -- Stable slug the sync script upserts against (from the folder name).
    code                 text not null unique,
    name                 text not null,
    description          text,
    -- Public URL of the compressed .glb in the models-3d bucket.
    model_url            text not null,
    -- Optional preview/poster image (rendered via <Image>).
    poster_url           text,
    product_type         text not null default 'shirt',
    -- When false the customer can recolor + view but not place logos.
    allow_logo_placement boolean not null default true,
    -- Preset anchors: [{ id, label, position:[x,y,z], normal:[x,y,z],
    -- rotation:[x,y,z], scale:number }]. Authored in the admin zone editor.
    zones                jsonb not null default '[]'::jsonb,
    is_active            boolean not null default true,
    sort_order           integer not null default 0,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create index if not exists idx_three_d_models_active
    on three_d_models(is_active, sort_order);

-- ── Which empresa sees which model (mirror company_products) ─────────
create table if not exists company_three_d_models (
    id         uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id) on delete cascade,
    model_id   uuid not null references three_d_models(id) on delete cascade,
    is_active  boolean not null default true,
    created_at timestamptz not null default now(),
    unique (company_id, model_id)
);

create index if not exists idx_company_three_d_models_company
    on company_three_d_models(company_id);
create index if not exists idx_company_three_d_models_model
    on company_three_d_models(model_id);

-- ── Customer design requests (header + per-zone logo children) ──────
create table if not exists custom_design_requests (
    id             uuid primary key default gen_random_uuid(),
    request_number bigint generated always as identity,
    company_id     uuid references companies(id) on delete set null,
    created_by     uuid references auth.users(id) on delete set null,
    model_id       uuid references three_d_models(id) on delete set null,
    model_name     text,
    status         text not null default 'sent'
                   check (status in ('sent','reviewed','converted','archived')),
    color_name     text,
    notes          text,
    -- Captured canvas snapshot (public URL in models-3d/previews/).
    preview_url    text,
    created_at     timestamptz not null default now()
);

create index if not exists idx_custom_design_requests_status
    on custom_design_requests(status, created_at desc);
create index if not exists idx_custom_design_requests_company
    on custom_design_requests(company_id);

create table if not exists custom_design_logos (
    id             uuid primary key default gen_random_uuid(),
    request_id     uuid not null references custom_design_requests(id) on delete cascade,
    zone_id        text,
    zone_label     text,
    logo_id        uuid references logos(id) on delete set null,
    -- Snapshots so review needs no live join (mirror quote_items).
    logo_image_url text,
    logo_name      text
);

create index if not exists idx_custom_design_logos_request
    on custom_design_logos(request_id);

-- ── RLS: authenticated role; admin gate lives at the route/action
-- layer, consistent with the rest of the app (order_stage_completions,
-- logos, company_products). Customer writes to design requests go
-- through their authenticated session from /o/<token>. ────────────────
alter table three_d_models          enable row level security;
alter table company_three_d_models  enable row level security;
alter table custom_design_requests  enable row level security;
alter table custom_design_logos     enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'three_d_models','company_three_d_models',
    'custom_design_requests','custom_design_logos'
  ]
  loop
    execute format('create policy "auth read %1$s" on %1$s for select to authenticated using (true);', t);
    execute format('create policy "auth insert %1$s" on %1$s for insert to authenticated with check (true);', t);
    execute format('create policy "auth update %1$s" on %1$s for update to authenticated using (true) with check (true);', t);
    execute format('create policy "auth delete %1$s" on %1$s for delete to authenticated using (true);', t);
  end loop;
end $$;

-- ── Storage bucket for the .glb models + previews ───────────────────
-- Dedicated bucket (models are large binaries, not images). Files are
-- compressed on ingest (~1-3 MB); cap kept generous for safety.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'models-3d',
    'models-3d',
    true,
    30 * 1024 * 1024,
    array['model/gltf-binary','application/octet-stream','image/png','image/jpeg','image/webp']
)
on conflict (id) do nothing;

create policy "Authenticated insert models-3d"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'models-3d');

create policy "Public read models-3d"
    on storage.objects for select
    to public
    using (bucket_id = 'models-3d');

create policy "Authenticated update models-3d"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'models-3d')
    with check (bucket_id = 'models-3d');

create policy "Authenticated delete models-3d"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'models-3d');
