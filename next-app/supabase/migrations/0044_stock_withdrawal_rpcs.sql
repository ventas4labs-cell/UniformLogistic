-- ─── Retiro lifecycle: request → review (approve/reject) → cancel ──────
-- Every balance change goes through _apply_company_stock_movement (0042)
-- so the reserve, the exit and the ledger rows land in one transaction.

-- Client creates the request and RESERVES the pieces. Done here rather than
-- via a plain INSERT so the caller can only ever touch their own company.
create or replace function public.request_stock_withdrawal(
  p_lines jsonb, p_recipient text default null, p_notes text default null,
  p_wants_delivery boolean default false
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_company_id uuid; v_id uuid; v_num integer; v_line jsonb;
  v_product uuid; v_size text; v_qty integer; v_avail integer;
  v_name text; v_total integer := 0;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select cu.company_id into v_company_id
  from company_users cu where cu.user_id = auth.uid() limit 1;
  if v_company_id is null then
    raise exception 'Tu usuario no está vinculado a una empresa' using errcode = '42501';
  end if;

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Agregá al menos una línea al retiro';
  end if;

  insert into stock_withdrawals (company_id, requested_by, recipient_name, notes, wants_delivery)
  values (v_company_id, auth.uid(), nullif(btrim(coalesce(p_recipient,'')),''),
          nullif(btrim(coalesce(p_notes,'')),''), coalesce(p_wants_delivery, false))
  returning id, withdrawal_number into v_id, v_num;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_product := (v_line->>'product_id')::uuid;
    v_size    := v_line->>'size';
    v_qty     := (v_line->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then continue; end if;

    select (cs.quantity_on_hand - cs.quantity_reserved), p.name
      into v_avail, v_name
    from company_stock cs
    join products p on p.id = cs.product_id
    where cs.company_id = v_company_id and cs.product_id = v_product and cs.size = v_size
    for update;

    if v_avail is null then
      raise exception 'No tenés esa combinación de producto y talla en stock';
    end if;
    if v_qty > v_avail then
      raise exception 'No hay suficiente stock disponible de % (%): pediste %, disponible %',
        v_name, v_size, v_qty, v_avail;
    end if;

    insert into stock_withdrawal_items (withdrawal_id, product_id, size, quantity)
    values (v_id, v_product, v_size, v_qty);

    perform public._apply_company_stock_movement(
      v_company_id, v_product, v_size, 'reserve', v_qty,
      'Retiro RETIRO-' || lpad(v_num::text, 5, '0') || ' (solicitado)', 'retiro'
    );
    v_total := v_total + v_qty;
  end loop;

  if v_total = 0 then
    raise exception 'El retiro no tiene cantidades válidas';
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'number', v_num, 'pieces', v_total);
end $function$;

revoke execute on function public.request_stock_withdrawal(jsonb,text,text,boolean) from anon, public;

-- Admin approves (release the reserve, book the exit) or rejects (release).
create or replace function public.review_stock_withdrawal(
  p_id uuid, p_approve boolean, p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_w stock_withdrawals%rowtype; v_it record; v_ref text;
begin
  perform public.assert_web_caller_is_admin();

  select * into v_w from stock_withdrawals where id = p_id for update;
  if not found then raise exception 'Retiro no encontrado'; end if;
  if v_w.status <> 'pending' then
    raise exception 'Este retiro ya fue % ', v_w.status;
  end if;
  v_ref := 'RETIRO-' || lpad(v_w.withdrawal_number::text, 5, '0');

  for v_it in select * from stock_withdrawal_items where withdrawal_id = p_id
  loop
    perform public._apply_company_stock_movement(
      v_w.company_id, v_it.product_id, v_it.size, 'release', v_it.quantity, v_ref, 'retiro');
    if p_approve then
      perform public._apply_company_stock_movement(
        v_w.company_id, v_it.product_id, v_it.size, 'exit', v_it.quantity,
        'Retiro ' || v_ref, 'retiro');
    end if;
  end loop;

  update stock_withdrawals
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = nullif(btrim(coalesce(p_note,'')),'')
   where id = p_id;

  return jsonb_build_object('ok', true, 'status', case when p_approve then 'approved' else 'rejected' end);
end $function$;

revoke execute on function public.review_stock_withdrawal(uuid,boolean,text) from anon, public;

-- Client (or admin) cancels a still-pending request; the reserve goes back.
create or replace function public.cancel_stock_withdrawal(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_w stock_withdrawals%rowtype; v_it record;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select * into v_w from stock_withdrawals where id = p_id for update;
  if not found then raise exception 'Retiro no encontrado'; end if;
  if v_w.status <> 'pending' then
    raise exception 'Solo se puede cancelar un retiro pendiente';
  end if;
  if not public.is_app_admin()
     and not exists (select 1 from company_users cu
                     where cu.user_id = auth.uid() and cu.company_id = v_w.company_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  for v_it in select * from stock_withdrawal_items where withdrawal_id = p_id
  loop
    perform public._apply_company_stock_movement(
      v_w.company_id, v_it.product_id, v_it.size, 'release', v_it.quantity,
      'RETIRO-' || lpad(v_w.withdrawal_number::text, 5, '0') || ' (cancelado)', 'retiro');
  end loop;

  update stock_withdrawals
     set status = 'cancelled', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;

  return jsonb_build_object('ok', true);
end $function$;

revoke execute on function public.cancel_stock_withdrawal(uuid) from anon, public;

notify pgrst, 'reload schema';
