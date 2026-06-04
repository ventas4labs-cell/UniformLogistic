-- ─── Station custom-link access tokens ─────────────────────────────
-- Each external station now gets a stable random token. The token
-- doubles as both:
--  1. The URL slug — admin shares /s/<token> with the station; that
--     route signs them in server-side and drops them on /station.
--  2. The auth.users password — server-side signInWithPassword runs
--     against this so we don't need a separate password field on the
--     admin form. Rotating the link = rotating the password, in one
--     server action.
--
-- Existing rows get a generated token here so the admin can copy a
-- URL immediately, but the auth password for those legacy rows still
-- matches what admin typed at creation; the "Regenerate link" button
-- in the UI is what aligns the password with the new token.

alter table station_users
    add column if not exists access_token text;

-- Backfill nulls with a 32-byte URL-safe random token.
update station_users
   set access_token = rtrim(
       translate(encode(gen_random_bytes(24), 'base64'), '+/', '-_'),
       '='
   )
 where access_token is null;

create unique index if not exists idx_station_users_access_token
    on station_users(access_token);

alter table station_users
    alter column access_token set not null;
