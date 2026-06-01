-- ─── Admin RLS bypass for station_users + station_assignments ───────
-- These tables ship with an RLS policy that lets the station user
-- read only their own row(s) — defense-in-depth for the station
-- shell. But the admin (ulogisticcr@gmail.com) needs to see every
-- station_users row to manage them on /admin/station-users, and
-- every station_assignment to render the chips on /admin/orders.
-- Currently admin gets back an empty set, which made the "Nueva
-- estación" modal appear to silently fail (the row was created;
-- the listing just couldn't see it).
--
-- Add a per-table policy that lets the hardcoded admin email read
-- the whole table. The email gate matches the rest of the app
-- (see lib/admin-acting-company.ts and the route layouts).

create policy "Admin reads all station_users"
    on station_users for select
    to authenticated
    using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');

create policy "Admin reads all station_assignments"
    on station_assignments for select
    to authenticated
    using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
