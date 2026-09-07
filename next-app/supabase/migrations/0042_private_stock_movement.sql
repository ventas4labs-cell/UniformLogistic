-- ─── Split the balance writer so non-admin flows can use it safely ────
-- The client-facing retiro request has to RESERVE stock, but
-- upsert_company_stock_movement is admin-gated (0040). Move the real logic
-- into a private function revoked from every web role: only other SECURITY
-- DEFINER functions (which run as the owner) can reach it, so each caller
-- supplies its own authorization.

create or replace function public._apply_company_stock_movement(
  p_company_id uuid, p_product_id uuid, p_size text, p_type text,
  p_quantity integer, p_reason text default null, p_source text default 'manual'
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_row            company_stock%rowtype;
    v_delta_on_hand  integer := 0;
    v_delta_reserved integer := 0;
begin
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
        'reserved', v_row.quantity_reserved + v_delta_reserved
    );
end $function$;

revoke execute on function public._apply_company_stock_movement(uuid,uuid,text,text,integer,text,text) from anon, authenticated, public;

-- The public entry point keeps the admin gate and now just delegates.
create or replace function public.upsert_company_stock_movement(
  p_company_id uuid, p_product_id uuid, p_size text, p_type text,
  p_quantity integer, p_reason text default null, p_source text default 'manual'
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
    perform public.assert_web_caller_is_admin();
    return public._apply_company_stock_movement(
        p_company_id, p_product_id, p_size, p_type, p_quantity, p_reason, p_source
    );
end $function$;

revoke execute on function public.upsert_company_stock_movement(uuid,uuid,text,text,integer,text,text) from anon, public;

notify pgrst, 'reload schema';
