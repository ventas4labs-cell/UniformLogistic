-- ─── Structural cross-ledger cap ────────────────────────────────────────
-- A piece is either delivered or stocked, never both. Until now the only
-- thing enforcing that was one TypeScript clamp over a browser-supplied
-- quantity, and the delivery leg (createDispatch) had no cap at all — which
-- is how 15 order lines ended up over-allocated by 334 pieces and needed the
-- 2026-08-22 manual reconciliation. This makes it structural: every writer
-- is covered, including direct PostgREST calls.

create or replace function public.enforce_combined_dispatch_cap()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ordered   integer;
  v_delivered integer;
  v_stocked   integer;
begin
  select quantity into v_ordered
  from order_items where id = new.order_item_id
  for update;

  if v_ordered is null then
    raise exception 'La linea % no existe', new.order_item_id
      using errcode = '23503';
  end if;

  select coalesce(sum(quantity), 0) into v_delivered
  from order_dispatch_items where order_item_id = new.order_item_id;

  select coalesce(sum(quantity), 0) into v_stocked
  from order_stock_entry_items where order_item_id = new.order_item_id;

  if v_delivered + v_stocked > v_ordered then
    raise exception
      'La linea % excede lo pedido: % despachadas + % en stock > % pedidas',
      new.order_item_id, v_delivered, v_stocked, v_ordered
      using errcode = '23514';
  end if;

  return new;
end $$;

-- AFTER, so the incoming row is included in the sums above.
drop trigger if exists trg_cap_dispatch_items on public.order_dispatch_items;
create constraint trigger trg_cap_dispatch_items
  after insert or update on public.order_dispatch_items
  deferrable initially immediate
  for each row execute function public.enforce_combined_dispatch_cap();

drop trigger if exists trg_cap_stock_entry_items on public.order_stock_entry_items;
create constraint trigger trg_cap_stock_entry_items
  after insert or update on public.order_stock_entry_items
  deferrable initially immediate
  for each row execute function public.enforce_combined_dispatch_cap();

notify pgrst, 'reload schema';
