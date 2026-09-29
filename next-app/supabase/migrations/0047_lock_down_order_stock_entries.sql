-- ─── Security: close the world-open stock-entry ledger ────────────────
-- order_stock_entries / order_stock_entry_items (0030) still carried their
-- original policies — SELECT USING (true) and INSERT WITH CHECK (true) for
-- every signed-in user — and anon/authenticated kept full table grants. So
-- any customer could read every company's entries and write fake ones.
-- Fake entry items feed the customer "Listo" status
-- (fetchStockEntryTotalsForOrders → deriveOrderProgress), the retiro
-- shortcut (withdrawablePiecesByOrder), and add_order_to_stock's own
-- "already added" figure — so a customer could flip any order to Listo, or
-- block Empaque from stocking it ("excede lo pendiente").
--
-- Nothing on the web writes these tables directly. Every entry goes through
-- add_order_to_stock (SECURITY DEFINER, admin-gated since 0039/0040) and the
-- 0041 cap trigger is SECURITY DEFINER too; both run as the tables' owner,
-- postgres, which bypasses RLS. ON DELETE CASCADE from order_items/orders
-- also runs as the owner. So the web roles only ever need SELECT, on:
--   - everything, for the admin: the Empaque / Entregas / Pedidos boards
--     and the dispatch action, which run on the admin's own session;
--   - their own company's orders, for customers: the "Listo" status on
--     /home and /orders, and the "Retirar" shortcut on /stock.
-- Station users get nothing: the station shell reads orders, stage
-- completions, item progress and fabric reports — never these tables — and
-- /admin is gated to the admin.
--
-- Same checks as 0043 (is_app_admin() + company_users membership), wrapped
-- in (select …) so Postgres evaluates them once per query, not per row.

drop policy if exists "Authenticated insert order_stock_entries" on public.order_stock_entries;
drop policy if exists "Authenticated insert order_stock_entry_items" on public.order_stock_entry_items;
drop policy if exists "Authenticated read order_stock_entries" on public.order_stock_entries;
drop policy if exists "Authenticated read order_stock_entry_items" on public.order_stock_entry_items;

revoke all on public.order_stock_entries from anon;
revoke all on public.order_stock_entry_items from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.order_stock_entries from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.order_stock_entry_items from authenticated;

create policy stock_entries_read on public.order_stock_entries
  for select to authenticated
  using (
    (select public.is_app_admin())
    or order_id in (
      select o.id from public.orders o
      where o.company_id in (
        select cu.company_id from public.company_users cu
        where cu.user_id = (select auth.uid())
      )
    )
  );

create policy stock_entry_items_read on public.order_stock_entry_items
  for select to authenticated
  using (
    (select public.is_app_admin())
    or entry_id in (
      select e.id from public.order_stock_entries e
      join public.orders o on o.id = e.order_id
      where o.company_id in (
        select cu.company_id from public.company_users cu
        where cu.user_id = (select auth.uid())
      )
    )
  );

notify pgrst, 'reload schema';
