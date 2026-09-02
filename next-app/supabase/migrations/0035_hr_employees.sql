-- ─── HR module · Phase 1: employee profiles ─────────────────────────
-- Employees are a 4th user population (after admin, company, station).
-- Each row's PK IS the auth.users id. Admin (hardcoded email) manages
-- them; each employee may read only their own row. The invite / set-own-
-- password flow uses activation_token (single-use, expiring).
--
-- Writes go through the service-role client in server actions (which
-- bypasses RLS), so the admin write policies below are belt-and-suspenders.

create table if not exists employees (
    id                    uuid primary key references auth.users(id) on delete cascade,
    full_name             text not null,
    email                 text not null,
    position              text,
    phone                 text,
    is_active             boolean not null default true,
    -- Invite / set-password flow (single-use token + expiry).
    activation_token      text,
    activation_expires_at timestamptz,
    activated_at          timestamptz,
    password_set_at       timestamptz,
    created_by            uuid,
    created_at            timestamptz not null default now()
);

create index if not exists idx_employees_activation_token on employees(activation_token);

alter table employees enable row level security;

-- Employee reads own row — used by the (employee) shell + the (app)
-- layout redirect. Returns null for admin/company/station users.
do $$ begin
    if not exists (select 1 from pg_policies where tablename = 'employees' and policyname = 'Employee reads own row') then
        create policy "Employee reads own row" on employees
            for select to authenticated using (id = auth.uid());
    end if;
end $$;

-- Admin (hardcoded email) full access — the SELECT policy is what lets
-- the /admin/rrhh page list employees via the authenticated admin client.
do $$ begin
    if not exists (select 1 from pg_policies where tablename = 'employees' and policyname = 'Admin reads employees') then
        create policy "Admin reads employees" on employees
            for select to authenticated
            using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;
    if not exists (select 1 from pg_policies where tablename = 'employees' and policyname = 'Admin inserts employees') then
        create policy "Admin inserts employees" on employees
            for insert to authenticated
            with check ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;
    if not exists (select 1 from pg_policies where tablename = 'employees' and policyname = 'Admin updates employees') then
        create policy "Admin updates employees" on employees
            for update to authenticated
            using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com')
            with check ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;
    if not exists (select 1 from pg_policies where tablename = 'employees' and policyname = 'Admin deletes employees') then
        create policy "Admin deletes employees" on employees
            for delete to authenticated
            using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;
end $$;

-- Keep employees out of the customer user directory (/admin/users),
-- the same way station users are already excluded.
create or replace function public.admin_list_users()
 returns table(user_id uuid, email text, full_name text, phone text, company_id uuid, company_name text, role text, signed_up_at timestamp with time zone)
 language sql
 security definer
 set search_path to 'public', 'auth'
as $function$
    select
        u.id as user_id,
        u.email::text as email,
        coalesce(u.raw_user_meta_data->>'full_name', '') as full_name,
        coalesce(u.raw_user_meta_data->>'phone', '') as phone,
        cu.company_id,
        c.name as company_name,
        cu.role,
        u.created_at as signed_up_at
    from auth.users u
    left join public.company_users cu on cu.user_id = u.id
    left join public.companies c on c.id = cu.company_id
    where not exists (
        select 1 from public.station_users su where su.id = u.id
    )
    and not exists (
        select 1 from public.employees e where e.id = u.id
    )
    order by u.created_at desc;
$function$;

-- PostgREST caches the schema; reload so the new table is queryable
-- immediately (see the gotcha in 0012 / 0034).
notify pgrst, 'reload schema';
