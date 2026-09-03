-- ─── Require a fresh QR scan for EVERY punch ────────────────────────
-- The kiosk shows one token to everybody for its 10-minute window, so a
-- globally single-use token would let the first employee to scan lock
-- everyone else out. Uniqueness is therefore per (token, employee): each
-- person may spend a given code exactly once. The composite PK makes the
-- claim atomic, so a double-tap or two tabs can't both punch.
create table if not exists hr_qr_token_uses (
    token_id    uuid not null references hr_qr_tokens(id) on delete cascade,
    employee_id uuid not null references auth.users(id) on delete cascade,
    used_at     timestamptz not null default now(),
    primary key (token_id, employee_id)
);

create index if not exists idx_hr_qr_token_uses_employee on hr_qr_token_uses(employee_id, used_at desc);

alter table hr_qr_token_uses enable row level security;

do $$ begin
    if not exists (select 1 from pg_policies where tablename='hr_qr_token_uses' and policyname='Employee reads own token uses') then
        create policy "Employee reads own token uses" on hr_qr_token_uses
            for select to authenticated using (employee_id = auth.uid());
    end if;
    if not exists (select 1 from pg_policies where tablename='hr_qr_token_uses' and policyname='Admin reads hr_qr_token_uses') then
        create policy "Admin reads hr_qr_token_uses" on hr_qr_token_uses
            for select to authenticated
            using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;
end $$;

notify pgrst, 'reload schema';
