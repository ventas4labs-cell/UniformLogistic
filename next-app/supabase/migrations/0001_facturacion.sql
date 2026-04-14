-- ─── Facturación Electrónica CR v4.4 — Schema ────────────────────────────
-- Run this in the Supabase SQL editor for project ooszrspxtxoucngvxvsq.

-- 1. fe_config: per-branch FE configuration (one row per "branch")
create table if not exists fe_config (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null unique,
  environment text not null check (environment in ('staging','production')) default 'staging',

  -- Emisor
  cedula_tipo text not null,
  cedula_numero text not null,
  nombre_emisor text not null,
  nombre_comercial text,
  codigo_actividad text not null,
  sucursal text not null default '001',
  punto_venta text not null default '00001',

  correo_emisor text,
  telefono_emisor text,

  -- Ubicación (text — converted via costa-rica-locations.ts)
  provincia text,
  canton text,
  distrito text,
  barrio text,
  otras_senas text,

  -- Hacienda credentials
  hacienda_username text not null,
  hacienda_password_encrypted text not null,

  -- P12 certificate (stored in Supabase Storage bucket "certificates")
  p12_certificate_path text,
  p12_pin_encrypted text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. fe_consecutivos: per-branch + tipo_documento sequential counter
create table if not exists fe_consecutivos (
  branch_id uuid not null,
  tipo_documento text not null,
  secuencial bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (branch_id, tipo_documento)
);

-- Atomic next-consecutivo function
create or replace function next_consecutivo(p_branch_id uuid, p_tipo text)
returns bigint
language plpgsql
as $$
declare
  v_next bigint;
begin
  insert into fe_consecutivos (branch_id, tipo_documento, secuencial, updated_at)
    values (p_branch_id, p_tipo, 1, now())
  on conflict (branch_id, tipo_documento)
    do update set secuencial = fe_consecutivos.secuencial + 1, updated_at = now()
    returning secuencial into v_next;
  return v_next;
end;
$$;

-- 3. fe_tokens: cached Hacienda OAuth tokens (one per branch)
create table if not exists fe_tokens (
  branch_id uuid primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- 4. fe_documentos: emitted electronic documents
create table if not exists fe_documentos (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  order_id uuid,

  clave text not null unique,
  consecutivo text not null,
  tipo_documento text not null,
  fecha_emision text not null,

  emisor_cedula text not null,
  emisor_nombre text not null,
  receptor_cedula text,
  receptor_nombre text,

  condicion_venta text not null,
  medio_pago text[] not null,

  total_venta numeric(18,5) not null default 0,
  total_descuentos numeric(18,5) not null default 0,
  total_impuesto numeric(18,5) not null default 0,
  total_comprobante numeric(18,5) not null default 0,

  xml_enviado text,
  xml_firmado text,
  xml_respuesta_hacienda text,

  estado_hacienda text not null default 'pendiente',
  estado_envio text not null default 'no_enviado',
  mensaje_hacienda text,
  intentos_envio integer not null default 0,
  ultimo_intento_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fe_documentos_branch on fe_documentos(branch_id);
create index if not exists idx_fe_documentos_order on fe_documentos(order_id);
create index if not exists idx_fe_documentos_estado on fe_documentos(estado_hacienda);
create index if not exists idx_fe_documentos_created on fe_documentos(created_at desc);

-- 5. fe_lineas: line items per document
create table if not exists fe_lineas (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references fe_documentos(id) on delete cascade,
  numero_linea integer not null,
  codigo_cabys text not null,
  detalle text not null,
  cantidad numeric(18,3) not null,
  unidad_medida text not null,
  precio_unitario numeric(18,5) not null,
  monto_total numeric(18,5) not null,
  monto_descuento numeric(18,5) not null default 0,
  naturaleza_descuento text,
  subtotal numeric(18,5) not null,
  codigo_impuesto text,
  codigo_tarifa text,
  tarifa numeric(5,2),
  monto_impuesto numeric(18,5),
  exoneracion_tipo text,
  exoneracion_numero text,
  exoneracion_institucion text,
  exoneracion_fecha text,
  exoneracion_porcentaje numeric(5,2),
  exoneracion_monto numeric(18,5),
  impuesto_neto numeric(18,5),
  monto_total_linea numeric(18,5) not null
);

create index if not exists idx_fe_lineas_doc on fe_lineas(documento_id);

-- 6. fe_audit_log: audit trail
create table if not exists fe_audit_log (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid,
  action text not null,
  document_id uuid,
  clave text,
  user_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_fe_audit_branch on fe_audit_log(branch_id, created_at desc);
create index if not exists idx_fe_audit_document on fe_audit_log(document_id);

-- 7. RLS: lock down everything to service role
alter table fe_config enable row level security;
alter table fe_consecutivos enable row level security;
alter table fe_tokens enable row level security;
alter table fe_documentos enable row level security;
alter table fe_lineas enable row level security;
alter table fe_audit_log enable row level security;

-- (No policies = only the service role / postgres can read/write these tables.)

-- 8. Storage bucket for .p12 certificates (run separately if needed)
-- insert into storage.buckets (id, name, public) values ('certificates','certificates',false)
--   on conflict (id) do nothing;
