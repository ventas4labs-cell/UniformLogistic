-- ─── Security: close public access to orders, order lines and companies ──
-- orders / order_items / companies still carried the policies from the
-- first schema — FOR ALL TO public USING (true) plus SELECT TO public USING
-- (true) — and anon + authenticated held every table grant. So the public
-- key alone (it ships in the browser bundle) could read every company's
-- orders, lines and contact data, including companies.access_token (the
-- fallback password of not-yet-activated company accounts) and the
-- activation / reset tokens, and could insert, update or delete any order,
-- line or company. Checked live 2026-09-23: an unauthenticated count
-- returned 111 orders, 359 lines and 15 companies.
--
-- Every legitimate reader and writer, mapped before writing this:
--   - Admin: boards, actions and "place on behalf of" run on the admin's
--     own session → everything, via is_app_admin().
--   - Customers (/home, /orders, /stock, /cuentas, catalog): their own
--     company's orders, lines and company row. fetchUserOrders also
--     matches orders they created (created_by). Checkout (createOrder)
--     inserts the order and its lines on the customer's session, and
--     deletes the order again if the lines fail.
--   - Stations (/station): only orders assigned to them in
--     station_assignments, and those orders' lines (the board lists them;
--     saveStageProgressAction reads line quantities). Stations never write
--     here. They get no companies access — a companies row carries login
--     tokens — so /station looks the customer names up server-side.
--   - Every public entry point (/o, /s, /d, /login, /activar, /ordenar,
--     /cotizar), facturación and the crons use the service-role client,
--     which bypasses RLS: anon needs nothing.
--   - SECURITY DEFINER RPCs run as postgres (BYPASSRLS), so policies don't
--     reach them; the two that touch these tables without an admin check
--     are fixed at the bottom.
--
-- Style follows 0043: a read policy per table (admin or the scoped reader)
-- plus an admin write policy, with the checkout exceptions spelled out.
-- is_app_admin() / auth.uid() are wrapped in (select …) so they run once
-- per query, not per row.

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.companies enable row level security;

drop policy if exists "Allow all access to orders" on public.orders;
drop policy if exists "Allow read access to all" on public.orders;
drop policy if exists "Allow all access to order_items" on public.order_items;
drop policy if exists "Allow read access to all" on public.order_items;
drop policy if exists "Admins can manage companies" on public.companies;
drop policy if exists "Companies can read own data" on public.companies;

-- Nothing for anon. Signed-in users keep SELECT/INSERT/UPDATE/DELETE (the
-- policies decide) but lose TRUNCATE — which ignores RLS — and
-- REFERENCES / TRIGGER, which no web flow needs.
revoke all on public.orders, public.order_items, public.companies from anon;
revoke truncate, references, trigger
  on public.orders, public.order_items, public.companies from authenticated;

-- Whether an order has no lines. SECURITY DEFINER so the checkout-rollback
-- policy below can ask without expanding order_items' policies, which read
-- orders — Postgres rejects policies that reference each other.
create or replace function public.order_is_empty(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select not exists (select 1 from public.order_items where order_id = p_order_id);
$$;
revoke execute on function public.order_is_empty(uuid) from public, anon;
grant execute on function public.order_is_empty(uuid) to authenticated;

-- ── orders ──────────────────────────────────────────────────────────────

create policy orders_read on public.orders
  for select to authenticated
  using (
    (select public.is_app_admin())
    or company_id in (
      select cu.company_id from public.company_users cu
      where cu.user_id = (select auth.uid())
    )
    or created_by = (select auth.uid())
    or id in (
      select sa.order_id from public.station_assignments sa
      where sa.station_user_id = (select auth.uid())
    )
  );

create policy orders_admin_write on public.orders
  for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

-- Checkout: a customer books an order for their own company, as
-- themselves, in the initial state.
create policy orders_checkout_insert on public.orders
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and status = 'pending'
    and company_id in (
      select cu.company_id from public.company_users cu
      where cu.user_id = (select auth.uid())
    )
  );

-- Checkout rollback only: createOrder deletes the order it has just made
-- when its lines fail to insert — its own, minutes old, still empty.
create policy orders_checkout_rollback on public.orders
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    and created_at > now() - interval '15 minutes'
    and public.order_is_empty(id)
  );

-- ── order_items ─────────────────────────────────────────────────────────

-- A line is readable exactly when its order is (customers: own company or
-- own orders; stations: assigned orders). orders_read decides, so the two
-- tables can't drift apart.
create policy order_items_read on public.order_items
  for select to authenticated
  using (
    (select public.is_app_admin())
    or order_id in (select o.id from public.orders o)
  );

create policy order_items_admin_write on public.order_items
  for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

-- Checkout: lines go onto an order the customer created minutes ago, and
-- are never corte extras (only the admin corte board adds those).
create policy order_items_checkout_insert on public.order_items
  for insert to authenticated
  with check (
    not is_extra
    and order_id in (
      select o.id from public.orders o
      where o.created_by = (select auth.uid())
        and o.created_at > now() - interval '15 minutes'
    )
  );

-- ── companies ───────────────────────────────────────────────────────────

-- Members read their own company (name, contact, custom-order flag, …).
create policy companies_read on public.companies
  for select to authenticated
  using (
    (select public.is_app_admin())
    or id in (
      select cu.company_id from public.company_users cu
      where cu.user_id = (select auth.uid())
    )
  );

create policy companies_admin_write on public.companies
  for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

-- ── RPCs that bypass all of the above ───────────────────────────────────

-- delete_order_with_history only checked that SOMEONE was signed in, so any
-- customer, station or employee could delete any order through it. Same
-- guard as add_order_to_stock; the body is otherwise unchanged.
create or replace function public.delete_order_with_history(p_order_uuid uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor uuid := auth.uid();
  v_actor_email text;
begin
  perform public.assert_web_caller_is_admin();

  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_actor_email from auth.users where id = v_actor;

  insert into public.deleted_orders_history (
    order_uuid, order_number, company_name, contact_name, purchase_order,
    status, estimated_delivery_date, notes,
    total_items, total_pieces, items_snapshot,
    original_created_at, deleted_by, deleted_by_email
  )
  select
    o.id,
    o.order_number,
    c.name,
    c.contact_name,
    o.purchase_order,
    o.status,
    o.estimated_delivery_date,
    o.notes,
    coalesce((select count(*)::int from order_items where order_id = o.id), 0),
    coalesce((select sum(quantity)::int from order_items where order_id = o.id), 0),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'product_code', oi.product_code,
            'product_name', oi.product_name,
            'size', oi.size,
            'quantity', oi.quantity
          )
          order by oi.product_name, oi.size
        )
        from order_items oi where oi.order_id = o.id
      ),
      '[]'::jsonb
    ),
    o.created_at,
    v_actor,
    v_actor_email
  from public.orders o
  left join public.companies c on c.id = o.company_id
  where o.id = p_order_uuid;

  -- If the order didn't exist, snapshot inserts zero rows — that's a
  -- no-op, mirror a delete of a non-existent row.
  if not found then
    return;
  end if;

  delete from public.orders where id = p_order_uuid;
end;
$function$;

-- admin_list_users had no check at all and anon could EXECUTE it: the
-- public key listed every account's email, name, phone and company. Only
-- the admin's users page calls it. Same query, now behind the guard.
create or replace function public.admin_list_users()
returns table(
  user_id uuid, email text, full_name text, phone text,
  company_id uuid, company_name text, role text, signed_up_at timestamptz
)
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
#variable_conflict use_column
begin
  perform public.assert_web_caller_is_admin();

  return query
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
end;
$function$;

revoke execute on function public.admin_list_users() from anon, public;
grant execute on function public.admin_list_users() to authenticated;

notify pgrst, 'reload schema';
