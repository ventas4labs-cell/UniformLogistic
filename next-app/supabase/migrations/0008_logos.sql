-- ─── Logos catalog ───────────────────────────────────────────────────
-- Logos are a special kind of insumo applied to products. Each logo
-- has an image and a category (bordado or impresion) so production
-- knows which stage applies it. Logos follow the same global+junction
-- pattern as products: each logo is created once, then assigned to one
-- or more companies via company_logos.
--
-- Product BOM rows reference logos by id; aggregation at order time
-- pulls in the name / image / category from this table.

create table if not exists logos (
    id           uuid primary key default gen_random_uuid(),
    name         text not null,
    image_url    text,
    category     text not null check (category in ('bordado','impresion')),
    notes        text,
    is_active    boolean not null default true,
    created_at   timestamptz not null default now()
);

alter table logos enable row level security;

create policy "Authenticated read logos"
    on logos for select to authenticated using (true);
create policy "Authenticated insert logos"
    on logos for insert to authenticated with check (true);
create policy "Authenticated update logos"
    on logos for update to authenticated using (true) with check (true);
create policy "Authenticated delete logos"
    on logos for delete to authenticated using (true);

create table if not exists company_logos (
    company_id uuid not null references companies(id) on delete cascade,
    logo_id    uuid not null references logos(id) on delete cascade,
    is_active  boolean not null default true,
    created_at timestamptz not null default now(),
    primary key (company_id, logo_id)
);

alter table company_logos enable row level security;

create policy "Authenticated read company_logos"
    on company_logos for select to authenticated using (true);
create policy "Authenticated insert company_logos"
    on company_logos for insert to authenticated with check (true);
create policy "Authenticated update company_logos"
    on company_logos for update to authenticated using (true) with check (true);
create policy "Authenticated delete company_logos"
    on company_logos for delete to authenticated using (true);

create index if not exists idx_company_logos_company on company_logos(company_id);
create index if not exists idx_company_logos_logo on company_logos(logo_id);
