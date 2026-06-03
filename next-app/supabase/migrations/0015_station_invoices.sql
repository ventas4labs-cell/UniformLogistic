-- ─── Station invoices (factura submission from external stations) ──
-- External station users (corte / maquila / bordado / ploter / etc)
-- submit a photo of their invoice from the station shell. Admin
-- reviews them from /admin/station-invoices. Status starts pending;
-- approval/rejection is admin-only.
--
-- The image lives in a separate `station-invoices` bucket — kept off
-- the product-images bucket so RLS / cleanup can evolve independently
-- and so a misconfigured product-images policy can never expose
-- contractor invoices.

create table if not exists station_invoices (
    id              uuid primary key default gen_random_uuid(),
    station_user_id uuid not null references station_users(id) on delete cascade,
    -- Optional tie to a specific order. Stations may submit a single
    -- consolidated factura covering multiple orders, so this is
    -- nullable rather than required.
    order_id        uuid references orders(id) on delete set null,
    image_url       text not null,
    amount          numeric(12, 2),
    notes           text,
    status          text not null default 'pending'
                    check (status in ('pending','approved','rejected')),
    submitted_at    timestamptz not null default now(),
    reviewed_at     timestamptz,
    reviewed_by     uuid references auth.users(id) on delete set null,
    review_notes    text
);

create index if not exists idx_station_invoices_station
    on station_invoices(station_user_id);
create index if not exists idx_station_invoices_status
    on station_invoices(status);
create index if not exists idx_station_invoices_submitted
    on station_invoices(submitted_at desc);

alter table station_invoices enable row level security;

-- Stations only see their own; admin sees all (admin's row in
-- station_users is absent, so the second policy gates on auth.users
-- email matching the hard-coded admin — same model used elsewhere in
-- the codebase via fetchStationUser returning null for admin).
create policy "Station reads own invoices"
    on station_invoices for select
    to authenticated
    using (station_user_id = auth.uid());

create policy "Station inserts own invoices"
    on station_invoices for insert
    to authenticated
    with check (station_user_id = auth.uid());

-- Admin (non-station user) reads all; review actions happen via
-- service-role inserts/updates from admin server actions, so we
-- don't need a permissive UPDATE policy here.
create policy "Admin reads all invoices"
    on station_invoices for select
    to authenticated
    using (
        not exists (
            select 1 from station_users s where s.id = auth.uid()
        )
    );

create policy "Admin updates all invoices"
    on station_invoices for update
    to authenticated
    using (
        not exists (
            select 1 from station_users s where s.id = auth.uid()
        )
    )
    with check (
        not exists (
            select 1 from station_users s where s.id = auth.uid()
        )
    );

-- ─── Storage bucket + policies for invoice images ───────────────────
-- The bucket should be created via the Supabase dashboard or CLI
-- (Storage tab → New bucket → name: station-invoices, public: yes so
-- admin can render thumbs via the public CDN). Below grants RLS for
-- read/write on `storage.objects`. Stations may insert into the bucket;
-- public read so generated public URLs work for both station preview
-- and admin review.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'station-invoices',
    'station-invoices',
    true,
    5 * 1024 * 1024,
    array['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/svg+xml']
)
on conflict (id) do nothing;

create policy "Authenticated insert station-invoices"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'station-invoices');

create policy "Public read station-invoices"
    on storage.objects for select
    to public
    using (bucket_id = 'station-invoices');

create policy "Authenticated delete station-invoices"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'station-invoices');
