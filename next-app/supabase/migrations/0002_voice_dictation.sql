-- ─── Phase 0: Schema hardening for product/stock dictation ─────────────
-- See PRODUCT_STOCK_DICTATION.md §3 + §11 (Phase 0).
--
-- This migration:
--   1. Adds the stock_movements ledger + dictation audit tables
--   2. Creates upsert_company_stock_movement(...) RPC
--   3. Enables Row Level Security on previously-unprotected tables
--      (company_stock, invoices, invoice_payments) plus the new tables
--   4. Installs an is_app_admin() helper that matches the existing
--      ADMIN_EMAIL gate used in next-app/app/(admin)/admin/layout.tsx
--
-- The dictation feature itself (Phase 1+) writes to the tables and RPC
-- introduced here.

-- ─── 1. Audit / ledger tables ──────────────────────────────────────────

create table if not exists stock_movements (
    id              uuid primary key default gen_random_uuid(),
    company_id      uuid not null references companies(id),
    product_id      uuid not null references products(id),
    size            text not null,
    type            text not null check (
        type in ('entry','exit','reserve','release','adjustment')
    ),
    quantity        integer not null check (quantity > 0),
    reason          text,
    source          text default 'manual',
    user_id         uuid references auth.users(id),
    created_at      timestamptz not null default now()
);

create index if not exists idx_stock_movements_company
    on stock_movements (company_id, created_at desc);
create index if not exists idx_stock_movements_product
    on stock_movements (product_id, size);

create table if not exists voice_stock_batches (
    id                  uuid primary key default gen_random_uuid(),
    company_id          uuid not null references companies(id),
    user_id             uuid not null references auth.users(id),
    transcript          text not null,
    parsed_commands     jsonb not null,
    applied_commands    jsonb not null,
    applied_count       integer not null default 0,
    failed_count        integer not null default 0,
    created_at          timestamptz not null default now()
);

create index if not exists idx_voice_batches_company
    on voice_stock_batches (company_id, created_at desc);

create table if not exists voice_product_drafts (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references auth.users(id),
    transcript          text not null,
    parsed_product      jsonb not null,
    created_product_id  uuid references products(id),
    created_at          timestamptz not null default now()
);

-- ─── 2. Admin gate helper ──────────────────────────────────────────────
-- Matches ADMIN_EMAIL in next-app/app/(admin)/admin/layout.tsx. When the
-- project gains a proper role system, swap this for a role lookup.

create or replace function is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
    select coalesce(
        (select email from auth.users where id = auth.uid()),
        ''
    ) = 'ulogisticcr@gmail.com'
$$;

revoke all on function is_app_admin() from public;
grant execute on function is_app_admin() to anon, authenticated;

-- ─── 3. RPC: upsert_company_stock_movement ─────────────────────────────
-- Atomically:
--   • lock (or insert) the company_stock row for the SKU
--   • mutate quantity_on_hand / quantity_reserved per the movement type
--   • write a stock_movements row
--   • return { ok, company_stock_id, on_hand, reserved }

create or replace function upsert_company_stock_movement(
    p_company_id   uuid,
    p_product_id   uuid,
    p_size         text,
    p_type         text,
    p_quantity     integer,
    p_reason       text default null,
    p_source       text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row               company_stock%rowtype;
    v_delta_on_hand     integer := 0;
    v_delta_reserved    integer := 0;
begin
    if p_quantity is null or p_quantity <= 0 then
        raise exception 'quantity must be > 0';
    end if;
    if p_type not in ('entry','exit','reserve','release','adjustment') then
        raise exception 'unknown type %', p_type;
    end if;

    -- Lock-or-create the SKU row.
    select * into v_row
    from company_stock
    where company_id = p_company_id
      and product_id = p_product_id
      and size       = p_size
    for update;

    if not found then
        insert into company_stock (
            company_id, product_id, size, quantity_on_hand, quantity_reserved
        ) values (
            p_company_id, p_product_id, p_size, 0, 0
        )
        returning * into v_row;
    end if;

    -- Compute deltas based on movement type.
    case p_type
        when 'entry'      then v_delta_on_hand  :=  p_quantity;
        when 'exit'       then v_delta_on_hand  := -p_quantity;
        when 'reserve'    then v_delta_reserved :=  p_quantity;
        when 'release'    then v_delta_reserved := -p_quantity;
        when 'adjustment' then
            -- p_quantity is interpreted as TARGET on_hand; compute delta.
            v_delta_on_hand := p_quantity - v_row.quantity_on_hand;
    end case;

    -- Friendly precondition checks (the column CHECK constraints would
    -- also catch these; we raise nicer messages first).
    if v_row.quantity_on_hand + v_delta_on_hand < 0 then
        raise exception 'insufficient on_hand: have %, need %',
            v_row.quantity_on_hand, abs(v_delta_on_hand);
    end if;
    if v_row.quantity_reserved + v_delta_reserved < 0 then
        raise exception 'cannot release more than reserved';
    end if;
    if (v_row.quantity_on_hand + v_delta_on_hand) <
       (v_row.quantity_reserved + v_delta_reserved) then
        raise exception 'reservation would exceed available stock';
    end if;

    update company_stock
       set quantity_on_hand  = quantity_on_hand  + v_delta_on_hand,
           quantity_reserved = quantity_reserved + v_delta_reserved,
           last_movement_at  = now(),
           updated_at        = now()
     where id = v_row.id;

    insert into stock_movements (
        company_id, product_id, size, type, quantity, reason, source, user_id
    ) values (
        p_company_id, p_product_id, p_size, p_type,
        case when p_type = 'adjustment' then abs(v_delta_on_hand) else p_quantity end,
        p_reason, coalesce(p_source, 'manual'), auth.uid()
    );

    return jsonb_build_object(
        'ok', true,
        'company_stock_id', v_row.id,
        'on_hand',  v_row.quantity_on_hand  + v_delta_on_hand,
        'reserved', v_row.quantity_reserved + v_delta_reserved
    );
end $$;

revoke all on function upsert_company_stock_movement(uuid, uuid, text, text, integer, text, text) from public;
grant execute on function upsert_company_stock_movement(uuid, uuid, text, text, integer, text, text) to authenticated;

-- ─── 4. Row Level Security ─────────────────────────────────────────────
-- Existing tables that today are publicly readable/writable via the
-- anon key (see Supabase advisory). Enabled BEFORE policies are created
-- inside the same transaction so there's no exposure window.

alter table company_stock      enable row level security;
alter table invoices           enable row level security;
alter table invoice_payments   enable row level security;

-- New tables introduced by this migration
alter table stock_movements        enable row level security;
alter table voice_stock_batches    enable row level security;
alter table voice_product_drafts   enable row level security;

-- ─── company_stock ─────────────────────────────────────────────────────
-- Read: members of that company OR admin
-- Write: admin only

drop policy if exists company_stock_read  on company_stock;
drop policy if exists company_stock_write on company_stock;

create policy company_stock_read on company_stock
    for select to authenticated
    using (
        company_id in (select company_id from company_users where user_id = auth.uid())
        or is_app_admin()
    );

create policy company_stock_write on company_stock
    for all to authenticated
    using      (is_app_admin())
    with check (is_app_admin());

-- ─── stock_movements ───────────────────────────────────────────────────
-- Read: same model as company_stock; Insert: admin only.

drop policy if exists stock_movements_read   on stock_movements;
drop policy if exists stock_movements_insert on stock_movements;

create policy stock_movements_read on stock_movements
    for select to authenticated
    using (
        company_id in (select company_id from company_users where user_id = auth.uid())
        or is_app_admin()
    );

create policy stock_movements_insert on stock_movements
    for insert to authenticated
    with check (is_app_admin());

-- ─── invoices / invoice_payments ───────────────────────────────────────
-- Mirror the existing customer-facing /cuentas behavior: members of a
-- company can read their invoices + payments; only admin writes.

drop policy if exists invoices_read  on invoices;
drop policy if exists invoices_write on invoices;

create policy invoices_read on invoices
    for select to authenticated
    using (
        company_id in (select company_id from company_users where user_id = auth.uid())
        or is_app_admin()
    );

create policy invoices_write on invoices
    for all to authenticated
    using      (is_app_admin())
    with check (is_app_admin());

drop policy if exists invoice_payments_read  on invoice_payments;
drop policy if exists invoice_payments_write on invoice_payments;

create policy invoice_payments_read on invoice_payments
    for select to authenticated
    using (
        invoice_id in (
            select i.id from invoices i
            where i.company_id in (
                select company_id from company_users where user_id = auth.uid()
            )
        )
        or is_app_admin()
    );

create policy invoice_payments_write on invoice_payments
    for all to authenticated
    using      (is_app_admin())
    with check (is_app_admin());

-- ─── voice_stock_batches / voice_product_drafts ────────────────────────
-- Admin-only.

drop policy if exists voice_stock_batches_admin   on voice_stock_batches;
drop policy if exists voice_product_drafts_admin  on voice_product_drafts;

create policy voice_stock_batches_admin on voice_stock_batches
    for all to authenticated
    using      (is_app_admin())
    with check (is_app_admin());

create policy voice_product_drafts_admin on voice_product_drafts
    for all to authenticated
    using      (is_app_admin())
    with check (is_app_admin());
