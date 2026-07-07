create table public.deleted_orders_history (
  id uuid primary key default gen_random_uuid(),
  order_uuid uuid not null,
  order_number integer not null,
  company_name text,
  contact_name text,
  purchase_order text,
  status text,
  estimated_delivery_date date,
  notes text,
  total_items integer not null default 0,
  total_pieces integer not null default 0,
  items_snapshot jsonb,
  original_created_at timestamptz,
  deleted_at timestamptz not null default now(),
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_by_email text
);

create index deleted_orders_history_deleted_at_idx
  on public.deleted_orders_history(deleted_at desc);
create index deleted_orders_history_order_number_idx
  on public.deleted_orders_history(order_number);

alter table public.deleted_orders_history enable row level security;

create policy "Authenticated read deleted orders history"
  on public.deleted_orders_history for select
  to authenticated using (true);

create policy "Authenticated insert deleted orders history"
  on public.deleted_orders_history for insert
  to authenticated with check (true);

-- Snapshot an order + its items into deleted_orders_history, then
-- delete the order. Runs inside a single transaction so a failure
-- anywhere rolls both sides back; the caller can't end up with a
-- ghost snapshot or a partial delete. SECURITY DEFINER because the
-- caller (browser-scoped anon key) doesn't need blanket delete rights
-- on orders — only the ability to invoke this vetted operation.
create or replace function public.delete_order_with_history(
  p_order_uuid uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_email text;
begin
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
$$;

grant execute on function public.delete_order_with_history(uuid) to authenticated;
