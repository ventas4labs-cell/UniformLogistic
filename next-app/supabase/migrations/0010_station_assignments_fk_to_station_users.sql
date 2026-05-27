-- ─── Fix embed for fetchAssignmentsForOrders ───────────────────────
-- station_assignments.station_user_id originally pointed at
-- auth.users(id), but PostgREST can't auto-embed station_users
-- through auth.users — the embed in fetchAssignmentsForOrders fails
-- with a generic PostgrestError on /admin/orders.
--
-- Retarget the FK at public.station_users(id). The delete-cascade
-- behavior is preserved: station_users.id already cascades from
-- auth.users so deleting the auth user still cleans up the
-- assignment row through the chain.

alter table station_assignments
    drop constraint if exists station_assignments_station_user_id_fkey;

alter table station_assignments
    add constraint station_assignments_station_user_id_fkey
    foreign key (station_user_id) references station_users(id) on delete cascade;
