-- ─── Per-company 3D custom-order toggle ─────────────────────────────
-- Master switch so the admin can turn the 3D custom-order feature off
-- for a specific empresa regardless of how many 3D models are assigned
-- to it. Defaults on; existing companies keep the feature.

alter table companies
    add column if not exists custom_order_enabled boolean not null default true;
