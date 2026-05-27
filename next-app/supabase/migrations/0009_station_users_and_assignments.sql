-- ─── External-station users (corte / maquila / bordado / ploter…) ──
-- These are outside the company. Each is bound to a single stage and
-- can only see the orders explicitly assigned to them. Layout-level
-- redirect sends them to /station; row-level security on
-- station_assignments enforces the read scope at the DB layer too.

create table if not exists station_users (
    id           uuid primary key references auth.users(id) on delete cascade,
    email        text not null,
    display_name text not null,
    stage        text not null check (stage in ('corte','maquila','impresion','bordado','ploter','empaque','bodega')),
    is_active    boolean not null default true,
    created_at   timestamptz not null default now(),
    created_by   uuid references auth.users(id) on delete set null
);

create index if not exists idx_station_users_stage on station_users(stage);
create index if not exists idx_station_users_email on station_users(email);

alter table station_users enable row level security;

create policy "Station user reads own row"
    on station_users for select
    to authenticated using (id = auth.uid());

-- ─── Assignments ────────────────────────────────────────────────────
create table if not exists station_assignments (
    order_id        uuid not null references orders(id) on delete cascade,
    station_user_id uuid not null references auth.users(id) on delete cascade,
    assigned_at     timestamptz not null default now(),
    assigned_by     uuid references auth.users(id) on delete set null,
    primary key (order_id, station_user_id)
);

create index if not exists idx_station_assignments_user on station_assignments(station_user_id);
create index if not exists idx_station_assignments_order on station_assignments(order_id);

alter table station_assignments enable row level security;

create policy "Station user reads own assignments"
    on station_assignments for select
    to authenticated using (station_user_id = auth.uid());
