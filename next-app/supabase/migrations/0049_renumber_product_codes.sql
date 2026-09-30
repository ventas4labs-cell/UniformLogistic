-- ─── Product codes: restart the numbering per client prefix ───────────
-- Codes are PREFIX-NNNN with one prefix per client (ULK9 = K9, ULPS =
-- Pacific Security, ULBI = básicos…), but the numbers came from a single
-- shared counter: each client's codes were scattered (ULK9-0008 …
-- ULK9-0077) and a few numbers repeated across clients (0001, 0014, 0075,
-- 0076). This keeps every prefix and renumbers its products 0001, 0002…
-- in the order of their current number.
--
-- It also folds the malformed codes into their prefix: UL-FCI0080…0085
-- join ULFCI, ULC.0076 becomes ULC-0004 and ULBI-001 gets four digits.
-- SISTEN's two products keep the bare UL- prefix.
--
-- Order lines and design requests linked to a product take its new code
-- (including lines still carrying a code from the previous renumbering),
-- so orders, production boards, PDFs and the portal match the catalogue.
-- Extras (no product) keep theirs; invoices already issued keep the codes
-- they were issued with. A line's code is still a snapshot, and codes can
-- change again from the product form, so the app no longer resolves a
-- product from an existing line's code (updateOrderFull,
-- withdrawablePiecesByOrder, admin tasks, the 3D preview).

create temporary table product_code_renumber as
with parsed as (
    select
        id,
        product_code as old_code,
        created_at,
        case
            when product_code ~ '^UL-[A-Z]+[0-9]+$'
                then 'UL' || substring(product_code from '^UL-([A-Z]+)[0-9]+$')
            else substring(product_code from '^([A-Z0-9]+)[-.][0-9]+$')
        end as prefix,
        substring(product_code from '([0-9]+)$')::int as num
    from public.products
)
select
    id,
    old_code,
    prefix || '-' || lpad(
        (row_number() over (partition by prefix order by num, created_at, id))::text,
        4,
        '0'
    ) as new_code
from parsed;

-- A code that doesn't parse gets a null new_code: stop before touching
-- anything rather than guess.
do $$
declare
    unparsed text;
begin
    select string_agg(old_code, ', ') into unparsed
    from product_code_renumber
    where new_code is null;
    if unparsed is not null then
        raise exception 'Códigos sin formato reconocible, no se renumeró nada: %', unparsed;
    end if;
end $$;

-- product_code is UNIQUE and not deferrable, and the new numbers overlap
-- the old ones (ULK9-0010 becomes ULK9-0003 while ULK9-0018 becomes
-- ULK9-0010), so park every changed row on a throwaway code first.
update public.products p
set product_code = 'renumber-' || p.id
from product_code_renumber r
where r.id = p.id
  and r.new_code <> r.old_code;

update public.products p
set product_code = r.new_code
from product_code_renumber r
where r.id = p.id
  and r.new_code <> r.old_code;

update public.order_items oi
set product_code = p.product_code
from public.products p
where p.id = oi.product_id
  and oi.product_code is distinct from p.product_code;

update public.custom_design_requests d
set product_code = p.product_code
from public.products p
where p.id = d.product_id
  and d.product_code is distinct from p.product_code;

drop table product_code_renumber;
