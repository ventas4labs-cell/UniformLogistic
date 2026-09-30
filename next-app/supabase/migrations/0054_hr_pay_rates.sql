-- ─── HR: hourly pay rates → automatic payroll (planilla) ─────────────
-- Each employee's salario por hora, kept as a dated history instead of a
-- single column: a raise "rige desde" a date, so recomputing an older
-- period still pays the hours worked back then at the rate in force back
-- then. /admin/rrhh/planilla multiplies punched hours by the rate that
-- applies on each day.
--
-- Reads: the admin and each employee for their own rows. Writes go
-- through a server action on the service-role client, which has already
-- checked the caller is the admin — so no write policies or grants.

create table if not exists public.hr_pay_rates (
    id             uuid primary key default gen_random_uuid(),
    employee_id    uuid not null references auth.users(id) on delete cascade,
    -- Colones per hour.
    hourly_rate    numeric(12,2) not null check (hourly_rate > 0),
    -- CR calendar date the rate applies from. Re-saving the same date
    -- replaces that entry, which is how a typo gets fixed.
    effective_from date not null,
    created_by     uuid,
    created_at     timestamptz not null default now(),
    unique (employee_id, effective_from)
);

alter table public.hr_pay_rates enable row level security;

revoke all on public.hr_pay_rates from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.hr_pay_rates from authenticated;

drop policy if exists hr_pay_rates_read on public.hr_pay_rates;
create policy hr_pay_rates_read on public.hr_pay_rates
  for select to authenticated
  using (
    employee_id = (select auth.uid())
    or (select public.is_app_admin())
  );

notify pgrst, 'reload schema';
