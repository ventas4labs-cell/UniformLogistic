-- Empaque can push finished order items into the company's stock. We
-- track what's been added per order line (mirroring order_dispatches)
-- so partial adds are safe and never exceed what was ordered.
create table public.order_stock_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.order_stock_entry_items (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.order_stock_entries(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  quantity integer not null check (quantity > 0)
);

create index order_stock_entries_order_id_idx on public.order_stock_entries(order_id);
create index order_stock_entry_items_entry_id_idx on public.order_stock_entry_items(entry_id);
create index order_stock_entry_items_order_item_idx on public.order_stock_entry_items(order_item_id);

alter table public.order_stock_entries enable row level security;
alter table public.order_stock_entry_items enable row level security;

create policy "Authenticated read order_stock_entries"
  on public.order_stock_entries for select to authenticated using (true);
create policy "Authenticated insert order_stock_entries"
  on public.order_stock_entries for insert to authenticated with check (true);
create policy "Authenticated read order_stock_entry_items"
  on public.order_stock_entry_items for select to authenticated using (true);
create policy "Authenticated insert order_stock_entry_items"
  on public.order_stock_entry_items for insert to authenticated with check (true);

-- Atomically record an "added to stock" entry for an order and push the
-- quantities into company_stock as `entry` movements (reusing the vetted
-- upsert_company_stock_movement). Enforces that a line never adds more
-- than ordered − already-added, so repeated partial adds stay bounded.
create or replace function public.add_order_to_stock(
  p_order_id uuid,
  p_lines jsonb,          -- [{ "order_item_id": uuid, "quantity": int }, ...]
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_order_number integer;
  v_ref text;
  v_entry_id uuid;
  v_line jsonb;
  v_item_id uuid;
  v_qty integer;
  v_product_id uuid;
  v_size text;
  v_ordered integer;
  v_already integer;
  v_applied integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select o.company_id, o.order_number into v_company_id, v_order_number
  from orders o where o.id = p_order_id;
  if v_company_id is null then
    raise exception 'La orden no tiene empresa asociada; no se puede agregar a stock';
  end if;
  v_ref := 'ORDEN-' || lpad(v_order_number::text, 5, '0');

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'No hay lineas para agregar';
  end if;

  insert into order_stock_entries (order_id, added_by, notes)
  values (p_order_id, auth.uid(), nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into v_entry_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_item_id := (v_line->>'order_item_id')::uuid;
    v_qty := (v_line->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      continue;
    end if;

    -- The item must belong to this order.
    select oi.product_id, oi.size, oi.quantity
      into v_product_id, v_size, v_ordered
    from order_items oi
    where oi.id = v_item_id and oi.order_id = p_order_id;
    if not found then
      raise exception 'La linea % no pertenece a la orden', v_item_id;
    end if;
    if v_product_id is null then
      raise exception 'La linea % no tiene producto vinculado; no se puede agregar a stock', v_item_id;
    end if;

    -- Remaining = ordered − already added (across all prior entries,
    -- plus any earlier iteration of this same loop, which is committed
    -- in-transaction and visible to this query).
    select coalesce(sum(i.quantity), 0) into v_already
    from order_stock_entry_items i
    join order_stock_entries e on e.id = i.entry_id
    where e.order_id = p_order_id and i.order_item_id = v_item_id;
    if v_qty > v_ordered - v_already then
      raise exception 'Cantidad para la linea % excede lo pendiente (pedido %, ya en stock %)',
        v_item_id, v_ordered, v_already;
    end if;

    insert into order_stock_entry_items (entry_id, order_item_id, quantity)
    values (v_entry_id, v_item_id, v_qty);

    perform public.upsert_company_stock_movement(
      v_company_id, v_product_id, v_size, 'entry', v_qty,
      'Empaque - ' || v_ref, 'empaque'
    );
    v_applied := v_applied + v_qty;
  end loop;

  if v_applied = 0 then
    raise exception 'No se agrego ninguna cantidad valida';
  end if;

  return jsonb_build_object('ok', true, 'entry_id', v_entry_id, 'added', v_applied);
end $$;

grant execute on function public.add_order_to_stock(uuid, jsonb, text) to authenticated;
