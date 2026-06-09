-- ─── "Extra" line items added at the corte stage ──────────────────
-- The corte operator sometimes needs to cut additional pieces beyond
-- the original order (replacements, samples, a forgotten size). These
-- are stored as normal order_items but flagged is_extra=true so every
-- downstream surface (boards, PDFs, the customer's view) can label
-- them as extras and not confuse them with the placed order.

alter table order_items
    add column if not exists is_extra boolean not null default false;

alter table order_items
    add column if not exists added_by uuid references auth.users(id) on delete set null;

alter table order_items
    add column if not exists note text;

create index if not exists idx_order_items_is_extra
    on order_items(order_id) where is_extra;
