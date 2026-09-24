-- ─── HR: employees are read-only on time data + time-off requests ────
-- The employee portal may only (1) punch by scanning the kiosk QR,
-- (2) request time off and (3) review their own hours. Every write goes
-- through a server action on the service-role client, which takes the
-- employee id from the verified session and the timestamp from the DB.
--
-- 0036 let employees INSERT their own hr_punches rows directly, so any
-- employee session could POST a punch with an arbitrary punched_at to
-- the REST API and skip the QR entirely. Drop it: employees now only
-- SELECT their own punches.
drop policy if exists "Employee inserts own punches" on hr_punches;

-- Time-off requests. Whole days, inclusive range, CR calendar dates.
create table if not exists hr_time_off_requests (
    id          uuid primary key default gen_random_uuid(),
    employee_id uuid not null references auth.users(id) on delete cascade,
    kind        text not null check (kind in ('vacation','sick','personal','other')),
    start_date  date not null,
    end_date    date not null,
    reason      text,
    status      text not null default 'pending'
                check (status in ('pending','approved','rejected','cancelled')),
    admin_note  text,
    reviewed_by uuid,
    reviewed_at timestamptz,
    created_at  timestamptz not null default now(),
    check (end_date >= start_date)
);

create index if not exists idx_hr_time_off_employee_start on hr_time_off_requests(employee_id, start_date desc);
create index if not exists idx_hr_time_off_status on hr_time_off_requests(status, start_date);

alter table hr_time_off_requests enable row level security;

-- Employee reads own; no employee write policy (server actions only).
do $$ begin
    if not exists (select 1 from pg_policies where tablename='hr_time_off_requests' and policyname='Employee reads own time off') then
        create policy "Employee reads own time off" on hr_time_off_requests
            for select to authenticated using (employee_id = auth.uid());
    end if;
    if not exists (select 1 from pg_policies where tablename='hr_time_off_requests' and policyname='Admin all hr_time_off_requests') then
        create policy "Admin all hr_time_off_requests" on hr_time_off_requests
            for all to authenticated
            using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com')
            with check ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;
end $$;

notify pgrst, 'reload schema';
