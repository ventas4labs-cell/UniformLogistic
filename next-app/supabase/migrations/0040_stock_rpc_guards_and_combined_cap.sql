-- ─── Stock RPC guards + combined cap inside add_order_to_stock ─────────
-- Both functions are SECURITY DEFINER, so RLS cannot protect them: the
-- authorization check has to live in the body. assert_web_caller_is_admin()
-- (0039) blocks anon/non-admin web callers while leaving service_role (cron)
-- and internal definer-to-definer calls alone.
--
-- add_order_to_stock additionally gains:
--   * FOR UPDATE on the order_items row, so two concurrent despachos of the
--     same line cannot both pass the cap;
--   * a COMBINED remaining (ordered − stocked − dispatched). It previously
--     counted only the stock ledger, so a piece could be delivered AND
--     stocked. 0041 backs this with a trigger covering every writer.

-- (function bodies below are the live definitions applied via the Supabase connector)

create or replace function public.upsert_company_stock_movement(p_company_id uuid, p_product_id uuid, p_size text, p_type text, p_quantity integer, p_reason text DEFAULT NULL::text, p_source text DEFAULT 'manual'::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
    v_row               company_stock%rowtype;
    v_delta_on_hand     integer := 0;
    v_delta_reserved    integer := 0;
begin
    perform public.assert_web_caller_is_admin();

    if p_quantity is null then
        raise exception 'quantity is required';
    end if;
    if p_type not in ('entry','exit','reserve','release','adjustment') then
        raise exception 'unknown type %', p_type;
    end if;
    if p_type <> 'adjustment' and p_quantity <= 0 then
        raise exception 'quantity must be > 0 for type %', p_type;
    end if;
    if p_type = 'adjustment' and p_quantity < 0 then
        raise exception 'adjustment target cannot be negative';
    end if;

    select * into v_row
    from company_stock
    where company_id = p_company_id and product_id = p_product_id and size = p_size
    for update;

    if not found then
        insert into company_stock (company_id, product_id, size, quantity_on_hand, quantity_reserved)
        values (p_company_id, p_product_id, p_size, 0, 0)
        returning * into v_row;
    end if;

    case p_type
        when 'entry'      then v_delta_on_hand  :=  p_quantity;
        when 'exit'       then v_delta_on_hand  := -p_quantity;
        when 'reserve'    then v_delta_reserved :=  p_quantity;
        when 'release'    then v_delta_reserved := -p_quantity;
        when 'adjustment' then v_delta_on_hand  := p_quantity - v_row.quantity_on_hand;
    end case;

    if v_row.quantity_on_hand + v_delta_on_hand < 0 then
        raise exception 'insufficient on_hand: have %, need %', v_row.quantity_on_hand, abs(v_delta_on_hand);
    end if;
    if v_row.quantity_reserved + v_delta_reserved < 0 then
        raise exception 'cannot release more than reserved';
    end if;
    if (v_row.quantity_on_hand + v_delta_on_hand) < (v_row.quantity_reserved + v_delta_reserved) then
        raise exception 'reservation would exceed available stock';
    end if;

    update company_stock
       set quantity_on_hand  = quantity_on_hand  + v_delta_on_hand,
           quantity_reserved = quantity_reserved + v_delta_reserved,
           last_movement_at  = now(),
           updated_at        = now()
     where id = v_row.id;

    if not (p_type = 'adjustment' and v_delta_on_hand = 0) then
        insert into stock_movements (company_id, product_id, size, type, quantity, reason, source, user_id)
        values (
            p_company_id, p_product_id, p_size, p_type,
            case when p_type = 'adjustment' then abs(v_delta_on_hand) else p_quantity end,
            p_reason, coalesce(p_source, 'manual'), auth.uid()
        );
    end if;

    return jsonb_build_object(
        'ok', true,
        'company_stock_id', v_row.id,
        'on_hand',  v_row.quantity_on_hand  + v_delta_on_hand,
        'reserved', v_row.quantity_reserved + v_delta_reserved,
        'noop',     (p_type = 'adjustment' and v_delta_on_hand = 0)
    );
end $function$;

create or replace function public.add_order_to_stock(p_order_id uuid, p_lines jsonb, p_notes text DEFAULT NULL::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
  perform public.assert_web_caller_is_admin();

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

    -- The item must belong to this order. FOR UPDATE serialises concurrent
    -- despachos of the same line.
    select oi.product_id, oi.size, oi.quantity
      into v_product_id, v_size, v_ordered
    from order_items oi
    where oi.id = v_item_id and oi.order_id = p_order_id
    for update;
    if not found then
      raise exception 'La linea % no pertenece a la orden', v_item_id;
    end if;
    if v_product_id is null then
      raise exception 'La linea % no tiene producto vinculado; no se puede agregar a stock', v_item_id;
    end if;

    -- Remaining = ordered − (already stocked + already dispatched). A piece
    -- goes to exactly one destination, so both ledgers must be counted.
    select coalesce((
             select sum(i.quantity) from order_stock_entry_items i
             join order_stock_entries e on e.id = i.entry_id
             where e.order_id = p_order_id and i.order_item_id = v_item_id), 0)
         + coalesce((
             select sum(di.quantity) from order_dispatch_items di
             join order_dispatches d on d.id = di.dispatch_id
             where d.order_id = p_order_id and di.order_item_id = v_item_id), 0)
      into v_already;

    if v_qty > v_ordered - v_already then
      raise exception 'Cantidad para la linea % excede lo pendiente (pedido %, ya despachado/en stock %)',
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
end $function$;

revoke execute on function public.upsert_company_stock_movement(uuid,uuid,text,text,integer,text,text) from anon, public;
revoke execute on function public.add_order_to_stock(uuid,jsonb,text) from anon, public;

notify pgrst, 'reload schema';
