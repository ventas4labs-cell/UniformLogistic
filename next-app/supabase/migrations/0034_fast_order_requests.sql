-- Public "Pedido rápido" (fast-order) lead-capture requests.
-- A logged-out customer picks basic products (size/color/qty) + contact
-- details; this lands as a request the admin reviews in Pedidos and
-- accepts to create a real order. Not an order until accepted.

-- Per-product selectable colors for the fast-order picker (and reusable
-- elsewhere). Array of { name, hex }.
alter table products
    add column if not exists colors jsonb not null default '[]'::jsonb;

create table if not exists order_requests (
    id             uuid primary key default gen_random_uuid(),
    request_number bigint generated always as identity,
    contact_name   text not null,
    contact_email  text,
    contact_phone  text,
    company_name   text,
    notes          text,
    status         text not null default 'pending'
                   check (status in ('pending','converted','rejected')),
    -- Array of { productId, productCode, productName, size, color, quantity, selection }
    items          jsonb not null default '[]'::jsonb,
    accepted_order_id uuid references orders(id) on delete set null,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_order_requests_status
    on order_requests (status, created_at desc);

alter table order_requests enable row level security;

-- Admin/authenticated review happens through the authenticated client;
-- public submits go through the service-role client (RLS bypassed), same
-- pattern as the /cotizar customer-quote flow. No public policy needed.
drop policy if exists "order_requests auth read"  on order_requests;
drop policy if exists "order_requests auth write" on order_requests;
create policy "order_requests auth read"
    on order_requests for select to authenticated using (true);
create policy "order_requests auth write"
    on order_requests for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
