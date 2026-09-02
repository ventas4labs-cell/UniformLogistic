-- ─── HR module · Phase 2: rotating-QR kiosks + punch log ────────────
-- A shared workplace screen shows a QR that rotates every ~10 min;
-- employees scan it with their own logged-in phone to punch. The kiosk
-- link (/rrhh/kiosko/<access_token>) is a secret, like station links.

-- Shared kiosk screen.
create table if not exists hr_kiosks (
    id           uuid primary key default gen_random_uuid(),
    label        text not null,
    access_token text unique not null,
    is_active    boolean not null default true,
    created_by   uuid,
    created_at   timestamptz not null default now()
);

-- The rotating punch token rendered as the QR. Validated (unexpired) at
-- punch time to prove the employee was physically at the screen.
create table if not exists hr_qr_tokens (
    id         uuid primary key default gen_random_uuid(),
    token      text unique not null,
    kiosk_id   uuid not null references hr_kiosks(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null
);
create index if not exists idx_hr_qr_tokens_kiosk_expires on hr_qr_tokens(kiosk_id, expires_at desc);

-- Raw punch events. Worked hours derived from ordered pairs.
create table if not exists hr_punches (
    id          uuid primary key default gen_random_uuid(),
    employee_id uuid not null references auth.users(id) on delete cascade,
    punch_type  text not null check (punch_type in ('in','out','break_start','break_end','lunch_start','lunch_end')),
    punched_at  timestamptz not null default now(),
    source      text not null default 'qr',
    qr_token_id uuid references hr_qr_tokens(id) on delete set null,
    created_at  timestamptz not null default now()
);
create index if not exists idx_hr_punches_employee_time on hr_punches(employee_id, punched_at);

alter table hr_kiosks enable row level security;
alter table hr_qr_tokens enable row level security;
alter table hr_punches enable row level security;

do $$ begin
    -- hr_kiosks: admin only (kiosk page reads by token via the service client).
    if not exists (select 1 from pg_policies where tablename='hr_kiosks' and policyname='Admin all hr_kiosks') then
        create policy "Admin all hr_kiosks" on hr_kiosks
            for all to authenticated
            using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com')
            with check ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;

    -- hr_qr_tokens: admin read; writes + validation via the service client.
    if not exists (select 1 from pg_policies where tablename='hr_qr_tokens' and policyname='Admin reads hr_qr_tokens') then
        create policy "Admin reads hr_qr_tokens" on hr_qr_tokens
            for select to authenticated
            using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;

    -- hr_punches: employee reads/inserts own; admin full.
    if not exists (select 1 from pg_policies where tablename='hr_punches' and policyname='Employee reads own punches') then
        create policy "Employee reads own punches" on hr_punches
            for select to authenticated using (employee_id = auth.uid());
    end if;
    if not exists (select 1 from pg_policies where tablename='hr_punches' and policyname='Employee inserts own punches') then
        create policy "Employee inserts own punches" on hr_punches
            for insert to authenticated with check (employee_id = auth.uid());
    end if;
    if not exists (select 1 from pg_policies where tablename='hr_punches' and policyname='Admin reads hr_punches') then
        create policy "Admin reads hr_punches" on hr_punches
            for select to authenticated
            using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;
    if not exists (select 1 from pg_policies where tablename='hr_punches' and policyname='Admin writes hr_punches') then
        create policy "Admin writes hr_punches" on hr_punches
            for all to authenticated
            using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com')
            with check ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;
end $$;

notify pgrst, 'reload schema';
