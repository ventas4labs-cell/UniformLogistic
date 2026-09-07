-- ─── Stock consumption: client-requested retiros ──────────────────────
-- Client stock only ever went up; nothing deducted pieces when units were
-- handed back to the customer. A client now requests a retiro from their
-- own stock; the pieces are RESERVED immediately (so the same units can't
-- be promised twice, and "disponibles" finally means something), and the
-- admin approves — which releases the reserve and books the exit.

create sequence if not exists stock_withdrawals_number_seq;

create table if not exists stock_withdrawals (
    id                uuid primary key default gen_random_uuid(),
    withdrawal_number integer not null default nextval('stock_withdrawals_number_seq'),
    company_id        uuid not null references companies(id) on delete cascade,
    status            text not null default 'pending'
                      check (status in ('pending','approved','rejected','cancelled')),
    requested_by      uuid,
    requested_at      timestamptz not null default now(),
    recipient_name    text,
    notes             text,
    wants_delivery    boolean not null default false,
    reviewed_by       uuid,
    reviewed_at       timestamptz,
    review_note       text,
    created_at        timestamptz not null default now(),
    -- Retiros ride the courier board but order_deliveries.order_id FKs to
    -- orders, so they carry their own scheduling state.
    scheduled_date    date,
    scheduled_at      timestamptz,
    scheduled_by      uuid,
    notified_at       timestamptz,
    delivered_at      timestamptz,
    delivered_by      uuid
);
create index if not exists idx_stock_withdrawals_company on stock_withdrawals(company_id, status);
create index if not exists idx_stock_withdrawals_scheduled
    on stock_withdrawals(scheduled_date)
    where scheduled_date is not null and delivered_at is null;

create table if not exists stock_withdrawal_items (
    id            uuid primary key default gen_random_uuid(),
    withdrawal_id uuid not null references stock_withdrawals(id) on delete cascade,
    product_id    uuid not null references products(id),
    size          text not null,
    quantity      integer not null check (quantity > 0)
);
create index if not exists idx_stock_withdrawal_items_w on stock_withdrawal_items(withdrawal_id);

alter table stock_withdrawals enable row level security;
alter table stock_withdrawal_items enable row level security;

do $$ begin
    if not exists (select 1 from pg_policies where tablename='stock_withdrawals' and policyname='withdrawals_read') then
        create policy withdrawals_read on stock_withdrawals for select to authenticated
        using (
            company_id in (select company_id from company_users where user_id = auth.uid())
            or public.is_app_admin()
        );
    end if;
    if not exists (select 1 from pg_policies where tablename='stock_withdrawals' and policyname='withdrawals_admin_write') then
        create policy withdrawals_admin_write on stock_withdrawals for all to authenticated
        using (public.is_app_admin()) with check (public.is_app_admin());
    end if;
    if not exists (select 1 from pg_policies where tablename='stock_withdrawal_items' and policyname='withdrawal_items_read') then
        create policy withdrawal_items_read on stock_withdrawal_items for select to authenticated
        using (
            withdrawal_id in (
                select id from stock_withdrawals
                where company_id in (select company_id from company_users where user_id = auth.uid())
            )
            or public.is_app_admin()
        );
    end if;
    if not exists (select 1 from pg_policies where tablename='stock_withdrawal_items' and policyname='withdrawal_items_admin_write') then
        create policy withdrawal_items_admin_write on stock_withdrawal_items for all to authenticated
        using (public.is_app_admin()) with check (public.is_app_admin());
    end if;
end $$;

notify pgrst, 'reload schema';
