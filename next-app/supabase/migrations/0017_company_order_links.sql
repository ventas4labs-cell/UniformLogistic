-- ─── Company order links ────────────────────────────────────────────
-- Empresas now place orders via an individual link instead of a
-- username/password account, mirroring the station /s/<token> model:
--   1. access_token  — the URL slug shared with the company; the
--      /o/<token> route signs them in and drops them on /catalog.
--   2. order_user_id — the auth.users row the link signs in as. Its
--      password equals access_token (set via the admin API), so the
--      route never needs a separate password field. Rotating the link
--      rotates the password in lockstep.
--   3. order_user_email — that user's (synthetic) email, stored so the
--      route can signInWithPassword without an extra admin lookup.
--
-- Columns are nullable: existing companies get their link provisioned
-- on demand from the admin UI (the order auth user can't be minted in
-- plain SQL), and new companies get it auto-provisioned at creation.

alter table companies
    add column if not exists access_token text;
alter table companies
    add column if not exists order_user_id uuid references auth.users(id) on delete set null;
alter table companies
    add column if not exists order_user_email text;

create unique index if not exists idx_companies_access_token
    on companies(access_token);
