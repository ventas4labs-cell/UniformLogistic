-- ─── Security: close the anon-callable stock RPCs + world-open tenancy ──
-- upsert_company_stock_movement / add_order_to_stock / delete_order_with_history
-- are SECURITY DEFINER, so they run as the table owner and bypass RLS. Their
-- bodies validated inputs but never the CALLER, and the `anon` role still held
-- EXECUTE (the original migration revoked PUBLIC, which does not remove the
-- separate grant Supabase gives anon). Anyone with the public key could
-- rewrite any company's stock.

revoke execute on function public.upsert_company_stock_movement(uuid,uuid,text,text,integer,text,text) from anon, public;
revoke execute on function public.add_order_to_stock(uuid,jsonb,text) from anon, public;
revoke execute on function public.delete_order_with_history(uuid) from anon, public;
revoke execute on function public.refresh_resumen_fiscal(uuid,text) from anon, public;

-- Stop the grant reappearing on anything created later.
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- Defence in depth: refuse web callers that aren't the admin, while leaving
-- service_role (cron) and internal definer-to-definer calls untouched.
create or replace function public.assert_web_caller_is_admin()
returns void
language plpgsql
stable
security definer
set search_path to 'public', 'auth'
as $$
begin
  if coalesce(current_setting('role', true), '') in ('anon', 'authenticated')
     and not public.is_app_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
end $$;

revoke execute on function public.assert_web_caller_is_admin() from anon, public;

-- company_users was cmd=ALL / roles=public / using=true, and every tenancy
-- check for stock, movements, invoices and payments routes through it — so
-- writing one row let anyone read another company's data.
alter table public.company_users enable row level security;
drop policy if exists "Allow all access to company_users" on public.company_users;
revoke select, insert, update, delete on public.company_users from anon;

create policy company_users_self_read on public.company_users
  for select to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

create policy company_users_admin_write on public.company_users
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

notify pgrst, 'reload schema';
