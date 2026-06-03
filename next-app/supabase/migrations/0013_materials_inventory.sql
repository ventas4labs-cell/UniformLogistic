-- ─── Materiales / insumos inventory (full schema) ──────────────────
-- A `materials` table existed from earlier scaffolding (id, name,
-- unit, description, is_active, created_at) with a CHECK enforcing
-- English unit values. Extend it into the full inventory model
-- admin needs.

alter table materials drop constraint if exists materials_unit_check;
alter table materials alter column unit set default 'unidad';

alter table materials add column if not exists category text;
alter table materials add column if not exists current_qty numeric not null default 0;
alter table materials add column if not exists min_qty numeric not null default 0;
alter table materials add column if not exists unit_cost numeric not null default 0;
alter table materials add column if not exists supplier text;
alter table materials add column if not exists notes text;
alter table materials add column if not exists updated_at timestamptz not null default now();
alter table materials add column if not exists updated_by uuid references auth.users(id) on delete set null;

do $$ begin
    if not exists (select 1 from pg_constraint where conname='materials_current_qty_nonneg') then
        alter table materials add constraint materials_current_qty_nonneg check (current_qty >= 0);
    end if;
    if not exists (select 1 from pg_constraint where conname='materials_min_qty_nonneg') then
        alter table materials add constraint materials_min_qty_nonneg check (min_qty >= 0);
    end if;
    if not exists (select 1 from pg_constraint where conname='materials_unit_cost_nonneg') then
        alter table materials add constraint materials_unit_cost_nonneg check (unit_cost >= 0);
    end if;
end $$;

create unique index if not exists idx_materials_name_unique_ci
    on materials (lower(trim(name)));
create index if not exists idx_materials_category on materials (category);
create index if not exists idx_materials_is_active on materials (is_active);

create or replace function materials_set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;
drop trigger if exists trg_materials_updated_at on materials;
create trigger trg_materials_updated_at
    before update on materials
    for each row execute function materials_set_updated_at();

alter table materials enable row level security;
do $$ begin
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='materials' and policyname='Admin reads materials') then
        create policy "Admin reads materials"
            on materials for select to authenticated
            using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='materials' and policyname='Admin inserts materials') then
        create policy "Admin inserts materials"
            on materials for insert to authenticated
            with check ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='materials' and policyname='Admin updates materials') then
        create policy "Admin updates materials"
            on materials for update to authenticated
            using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com')
            with check ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='materials' and policyname='Admin deletes materials') then
        create policy "Admin deletes materials"
            on materials for delete to authenticated
            using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;
end $$;

-- Seed from existing product BOMs. Skip labor/service entries
-- ("Servicio Corte", "Servicio de Maquila", bare "Bordado",
-- "Sublimación", "DTF", …) — those are production steps, not
-- materials. Canonical exclusion list mirrored in migration 0014.
insert into materials (name, unit, current_qty)
select trim(b->>'name') as name, 'unidad', 0
from products p
cross join jsonb_array_elements(p.bom_json) b
where b->>'name' is not null
  and trim(b->>'name') <> ''
  and lower(trim(b->>'name')) not like 'servicio %'
  and lower(trim(b->>'name')) not like 'servicio_%'
  and lower(trim(b->>'name')) not in (
        'servicio',
        'corte',
        'bordado',
        'sublimación',
        'sublimacion',
        'sublimado',
        'dtf'
      )
on conflict (lower(trim(name))) do nothing;
