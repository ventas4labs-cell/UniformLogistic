-- ─── Security: drop the default grants on the HR tables ───────────────
-- The HR tables from 0035–0038 and 0045–0046 still carried Supabase's
-- default grants: anon and authenticated held SELECT, INSERT, UPDATE,
-- DELETE, TRUNCATE, REFERENCES and TRIGGER on all of them. RLS hid the
-- rows, but TRUNCATE is not subject to RLS, and the anon grant listed all
-- eight tables in the public GraphQL schema.
--
-- Every legitimate reader and writer, mapped before writing this:
--   - Writes: every insert / update / upsert / delete (employees and their
--     invites, kiosks, QR tokens and per-employee claims, punches,
--     schedules, time-off requests) runs in a server action on the
--     service-role client, after the action has checked the caller. Punch
--     corrections go through hr_admin_correct_punch, which only
--     service_role may execute (0046).
--   - Public pages: /rrhh/kiosko/<token> with its token-rotation action and
--     /activar-empleado/<token> with its set-password action use the
--     service-role client, so anon needs nothing.
--   - Reads on the user's own session, through the existing policies: the
--     admin's /admin/rrhh pages (everything), and each employee's own row,
--     punches, schedule, token uses and time-off requests (/empleado, the
--     (app) layout's employee check, the marcar / permisos actions).
--   - admin_list_users() is SECURITY DEFINER and reads employees as the
--     owner, so it is unaffected.
-- The /admin/rrhh pages also run their queries on a sessionless request,
-- because Next renders the page segment alongside the layout's redirect to
-- /login. Those queries now fail with "permission denied" instead of
-- returning zero rows, and the redirect still wins — as it already does on
-- /admin/rrhh/planilla, whose hr_pay_rates read has had no anon grant
-- since 0054.
--
-- Same shape as 0047 / 0048 and 0054: anon loses everything,
-- authenticated keeps SELECT only. Policies are untouched: the admin write
-- policies can no longer be reached, and the FOR ALL ones still serve the
-- admin's reads.

revoke all on
    public.employees,
    public.employee_schedules,
    public.hr_punches,
    public.hr_kiosks,
    public.hr_qr_tokens,
    public.hr_qr_token_uses,
    public.hr_time_off_requests,
    public.hr_punch_edits
  from anon;

revoke insert, update, delete, truncate, references, trigger on
    public.employees,
    public.employee_schedules,
    public.hr_punches,
    public.hr_kiosks,
    public.hr_qr_tokens,
    public.hr_qr_token_uses,
    public.hr_time_off_requests,
    public.hr_punch_edits
  from authenticated;

notify pgrst, 'reload schema';
