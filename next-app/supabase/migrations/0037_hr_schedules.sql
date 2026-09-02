-- ─── HR module · Phase 3: per-employee work schedule ────────────────
-- The baseline the attendance dashboard compares actual punches against
-- (late / early / over-long break·lunch / absent). One uniform daily
-- template per employee; per-weekday overrides can come later.
create table if not exists employee_schedules (
    employee_id uuid primary key references auth.users(id) on delete cascade,
    workdays    int[] not null default '{1,2,3,4,5}',  -- 0=Sun .. 6=Sat
    start_time  time not null default '08:00',
    end_time    time not null default '17:00',
    lunch_min   int not null default 60,
    break_min   int not null default 15,
    grace_min   int not null default 5,
    tz          text not null default 'America/Costa_Rica',
    updated_at  timestamptz not null default now()
);

alter table employee_schedules enable row level security;

do $$ begin
    if not exists (select 1 from pg_policies where tablename='employee_schedules' and policyname='Employee reads own schedule') then
        create policy "Employee reads own schedule" on employee_schedules
            for select to authenticated using (employee_id = auth.uid());
    end if;
    if not exists (select 1 from pg_policies where tablename='employee_schedules' and policyname='Admin all employee_schedules') then
        create policy "Admin all employee_schedules" on employee_schedules
            for all to authenticated
            using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com')
            with check ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;
end $$;

notify pgrst, 'reload schema';
