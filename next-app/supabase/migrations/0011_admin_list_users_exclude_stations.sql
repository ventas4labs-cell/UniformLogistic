-- ─── Keep station users out of the customer user directory ─────────
-- /admin/users used to list every auth.users row, which meant station
-- accounts (corte/maquila/etc.) showed up alongside customer accounts
-- and could even be edited/assigned to companies. Station and
-- customer users are meant to be disjoint sets — station accounts
-- live in their own /admin/station-users page.
--
-- Re-define admin_list_users to exclude any auth user that has a
-- station_users row.

create or replace function public.admin_list_users()
returns table (
    user_id      uuid,
    email        text,
    full_name    text,
    phone        text,
    company_id   uuid,
    company_name text,
    role         text,
    signed_up_at timestamptz
)
language sql
security definer
set search_path = 'public', 'auth'
as $$
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
    order by u.created_at desc;
$$;
