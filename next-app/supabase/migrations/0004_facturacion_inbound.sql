-- ─── Phase F5: inbound supplier invoices + fiscal summaries ──────────
-- Adds the schema needed to receive supplier facturas, acknowledge them
-- via Mensaje Receptor (10), and aggregate monthly fiscal totals for
-- D-104 IVA reporting.
--
-- All tables are branch_id-scoped to match fe_documentos and protected
-- by the same admin-only RLS pattern.

-- ─── 1. Inbound supplier invoices ─────────────────────────────────────
-- Stores raw XML of facturas received from suppliers (scraped from
-- email, pulled from Hacienda's Listar Comprobantes API, or uploaded by
-- the admin). Acknowledgement (Mensaje Receptor) is required within
-- 8 days; we track its state separately on this row.

create table if not exists fe_facturas_recibidas (
    id                      uuid primary key default gen_random_uuid(),
    branch_id               uuid not null references companies(id),
    clave                   text not null unique,
    consecutivo             text,
    tipo_documento          text not null check (
        tipo_documento in ('01','02','03','04','08')
    ),
    fecha_emision           text not null,
    emisor_cedula           text not null,
    emisor_nombre           text,
    receptor_cedula         text,
    receptor_nombre         text,
    total_venta             numeric default 0,
    total_descuentos        numeric default 0,
    total_impuesto          numeric default 0,
    total_comprobante       numeric default 0,
    xml_original            text not null,           -- as received
    /** Mensaje Receptor we sent to acknowledge this — null until ACK'd. */
    mensaje_receptor_id     uuid references fe_documentos(id),
    estado_acuse            text not null default 'pendiente' check (
        estado_acuse in ('pendiente','aceptado','aceptado_parcial','rechazado')
    ),
    received_at             timestamptz not null default now(),
    /** Ack deadline = received_at + 8 days. */
    ack_deadline            timestamptz generated always as (received_at + interval '8 days') stored,
    notes                   text
);
create index if not exists idx_facturas_recibidas_branch
    on fe_facturas_recibidas (branch_id, received_at desc);
create index if not exists idx_facturas_recibidas_estado
    on fe_facturas_recibidas (estado_acuse, ack_deadline);

create table if not exists fe_lineas_recibidas (
    id              uuid primary key default gen_random_uuid(),
    factura_id      uuid not null references fe_facturas_recibidas(id) on delete cascade,
    numero_linea    integer not null,
    codigo_cabys    text,
    detalle         text,
    cantidad        numeric,
    unidad_medida   text,
    precio_unitario numeric,
    subtotal        numeric,
    monto_impuesto  numeric,
    monto_total_linea numeric
);
create index if not exists idx_lineas_recibidas_factura
    on fe_lineas_recibidas (factura_id, numero_linea);

-- ─── 2. Receptor book — saved customers ───────────────────────────────
-- Pre-fills the receptor section when emitting repeat invoices.

create table if not exists fe_receptores (
    id                  uuid primary key default gen_random_uuid(),
    branch_id           uuid not null references companies(id),
    nombre              text not null,
    tipo_identificacion text not null,
    numero_identificacion text not null,
    correo              text,
    telefono            text,
    provincia           text,
    canton              text,
    distrito            text,
    barrio              text,
    otras_senas         text,
    created_at          timestamptz not null default now(),
    unique (branch_id, numero_identificacion)
);

-- ─── 3. Fiscal summary — pre-computed monthly D-104 ──────────────────
-- The IVA-104 form aggregates a calendar month of sales by tariff.
-- We keep one row per (branch_id, month) and refresh it nightly.

create table if not exists fe_resumen_fiscal (
    id                  uuid primary key default gen_random_uuid(),
    branch_id           uuid not null references companies(id),
    periodo             text not null,                -- 'YYYY-MM'
    total_documentos    integer not null default 0,
    total_aceptados     integer not null default 0,
    total_rechazados    integer not null default 0,
    total_venta         numeric not null default 0,
    total_descuentos    numeric not null default 0,
    total_iva_13        numeric not null default 0,   -- sales taxed at tarifa 08 (13%)
    total_iva_otras     numeric not null default 0,   -- sales at 1/2/4% etc.
    total_exento        numeric not null default 0,
    total_exonerado     numeric not null default 0,
    total_comprobante   numeric not null default 0,
    /** IVA you can credit from supplier invoices (entradas). */
    total_iva_acreditable numeric not null default 0,
    refreshed_at        timestamptz not null default now(),
    unique (branch_id, periodo)
);
create index if not exists idx_resumen_fiscal_periodo
    on fe_resumen_fiscal (periodo desc, branch_id);

-- ─── 4. RLS ───────────────────────────────────────────────────────────

alter table fe_facturas_recibidas enable row level security;
alter table fe_lineas_recibidas   enable row level security;
alter table fe_receptores         enable row level security;
alter table fe_resumen_fiscal     enable row level security;

drop policy if exists fe_facturas_recibidas_admin on fe_facturas_recibidas;
drop policy if exists fe_lineas_recibidas_admin   on fe_lineas_recibidas;
drop policy if exists fe_receptores_admin         on fe_receptores;
drop policy if exists fe_resumen_fiscal_read      on fe_resumen_fiscal;
drop policy if exists fe_resumen_fiscal_write     on fe_resumen_fiscal;

create policy fe_facturas_recibidas_admin on fe_facturas_recibidas
    for all to authenticated
    using (is_app_admin()) with check (is_app_admin());

create policy fe_lineas_recibidas_admin on fe_lineas_recibidas
    for all to authenticated
    using (is_app_admin()) with check (is_app_admin());

create policy fe_receptores_admin on fe_receptores
    for all to authenticated
    using (is_app_admin()) with check (is_app_admin());

-- Resumen fiscal: read by anyone (it's just rolled-up org-wide stats),
-- write only by admin. The admin-facing page is the only consumer today
-- but customer-side rollups could re-use it later.
create policy fe_resumen_fiscal_read on fe_resumen_fiscal
    for select to authenticated
    using (true);

create policy fe_resumen_fiscal_write on fe_resumen_fiscal
    for all to authenticated
    using (is_app_admin()) with check (is_app_admin());

-- ─── 5. Refresh function for fe_resumen_fiscal ────────────────────────
-- Rebuilds the monthly snapshot from fe_documentos. Cheap enough to run
-- nightly. Use `select refresh_resumen_fiscal(p_branch_id, 'YYYY-MM')`
-- from a cron route to recompute current+previous month.

create or replace function refresh_resumen_fiscal(
    p_branch_id uuid,
    p_periodo   text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_start timestamptz := (p_periodo || '-01')::date;
    v_end   timestamptz := (v_start + interval '1 month');
    v_row   record;
begin
    select
        count(*)                                                              as total_documentos,
        count(*) filter (where estado_hacienda in ('aceptado','aceptado_parcial')) as total_aceptados,
        count(*) filter (where estado_hacienda = 'rechazado')                   as total_rechazados,
        coalesce(sum(total_venta), 0)                                          as total_venta,
        coalesce(sum(total_descuentos), 0)                                     as total_descuentos,
        coalesce(sum(total_impuesto), 0)                                       as total_impuesto,
        coalesce(sum(total_comprobante), 0)                                    as total_comprobante
    into v_row
    from fe_documentos
    where branch_id = p_branch_id
      and tipo_documento in ('01','03','04')             -- exclude NC negative? F5 v2 can refine
      and estado_hacienda in ('aceptado','aceptado_parcial','rechazado','procesando','pendiente','error')
      and (fecha_emision::timestamptz) >= v_start
      and (fecha_emision::timestamptz) < v_end;

    insert into fe_resumen_fiscal (
        branch_id, periodo, total_documentos, total_aceptados, total_rechazados,
        total_venta, total_descuentos, total_iva_13, total_iva_otras,
        total_exento, total_exonerado, total_comprobante, total_iva_acreditable,
        refreshed_at
    ) values (
        p_branch_id, p_periodo,
        coalesce(v_row.total_documentos, 0),
        coalesce(v_row.total_aceptados, 0),
        coalesce(v_row.total_rechazados, 0),
        coalesce(v_row.total_venta, 0),
        coalesce(v_row.total_descuentos, 0),
        coalesce(v_row.total_impuesto, 0),     -- v1: lump all IVA into total_iva_13
        0,
        0, 0,
        coalesce(v_row.total_comprobante, 0),
        0,
        now()
    )
    on conflict (branch_id, periodo) do update set
        total_documentos    = excluded.total_documentos,
        total_aceptados     = excluded.total_aceptados,
        total_rechazados    = excluded.total_rechazados,
        total_venta         = excluded.total_venta,
        total_descuentos    = excluded.total_descuentos,
        total_iva_13        = excluded.total_iva_13,
        total_comprobante   = excluded.total_comprobante,
        refreshed_at        = excluded.refreshed_at;
end $$;

revoke all on function refresh_resumen_fiscal(uuid, text) from public;
grant execute on function refresh_resumen_fiscal(uuid, text) to authenticated;
