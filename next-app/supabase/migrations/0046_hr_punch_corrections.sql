-- ─── HR: admin punch corrections with an audit trail ────────────────
-- Employees can't touch their time (0045). When a marcaje is wrong or
-- missing, the admin fixes it from /admin/rrhh/asistencia/<employee>.
-- Every add / edit / delete is written to hr_punch_edits together with
-- the change itself — one function, one transaction — so a correction
-- can never land without its record.
--
-- hr_punches.source: 'qr' = untouched kiosk scan, 'admin' = created or
-- changed by an admin correction.

create table if not exists hr_punch_edits (
    id          uuid primary key default gen_random_uuid(),
    -- No FK: the log must outlive a deleted punch.
    punch_id    uuid not null,
    employee_id uuid not null references auth.users(id) on delete cascade,
    -- CR calendar day the punch belongs to (for the per-day history).
    work_date   date not null,
    action      text not null check (action in ('create','update','delete')),
    -- {punch_type, punched_at}; null before a create / after a delete.
    before      jsonb,
    after       jsonb,
    reason      text not null check (length(btrim(reason)) > 0),
    edited_by   uuid not null,
    edited_at   timestamptz not null default now()
);

create index if not exists idx_hr_punch_edits_employee_date on hr_punch_edits(employee_id, work_date, edited_at desc);

alter table hr_punch_edits enable row level security;

do $$ begin
    if not exists (select 1 from pg_policies where tablename='hr_punch_edits' and policyname='Admin reads hr_punch_edits') then
        create policy "Admin reads hr_punch_edits" on hr_punch_edits
            for select to authenticated
            using ((auth.jwt() ->> 'email') = 'ulogisticcr@gmail.com');
    end if;
end $$;

-- Apply one correction + its audit row atomically. Service role only
-- (EXECUTE revoked below); the server action has already checked the
-- caller is the admin and passes their id as p_edited_by.
create or replace function public.hr_admin_correct_punch(
    p_action      text,
    p_employee_id uuid,
    p_punch_id    uuid,
    p_punch_type  text,
    p_punched_at  timestamptz,
    p_reason      text,
    p_edited_by   uuid
) returns uuid
language plpgsql
set search_path = public
as $$
declare
    v_old hr_punches%rowtype;
    v_id  uuid;
begin
    if p_reason is null or length(btrim(p_reason)) = 0 then
        raise exception 'reason required';
    end if;

    if p_action = 'create' then
        insert into hr_punches (employee_id, punch_type, punched_at, source)
        values (p_employee_id, p_punch_type, p_punched_at, 'admin')
        returning id into v_id;

        insert into hr_punch_edits (punch_id, employee_id, work_date, action, before, after, reason, edited_by)
        values (
            v_id, p_employee_id,
            (p_punched_at at time zone 'America/Costa_Rica')::date,
            'create', null,
            jsonb_build_object('punch_type', p_punch_type, 'punched_at', p_punched_at),
            btrim(p_reason), p_edited_by
        );
        return v_id;
    end if;

    select * into v_old from hr_punches
     where id = p_punch_id and employee_id = p_employee_id
     for update;
    if not found then
        raise exception 'punch not found';
    end if;

    if p_action = 'update' then
        update hr_punches
           set punch_type = p_punch_type,
               punched_at = p_punched_at,
               source     = 'admin'
         where id = p_punch_id;

        insert into hr_punch_edits (punch_id, employee_id, work_date, action, before, after, reason, edited_by)
        values (
            p_punch_id, p_employee_id,
            (p_punched_at at time zone 'America/Costa_Rica')::date,
            'update',
            jsonb_build_object('punch_type', v_old.punch_type, 'punched_at', v_old.punched_at),
            jsonb_build_object('punch_type', p_punch_type, 'punched_at', p_punched_at),
            btrim(p_reason), p_edited_by
        );
        return p_punch_id;
    elsif p_action = 'delete' then
        delete from hr_punches where id = p_punch_id;

        insert into hr_punch_edits (punch_id, employee_id, work_date, action, before, after, reason, edited_by)
        values (
            p_punch_id, p_employee_id,
            (v_old.punched_at at time zone 'America/Costa_Rica')::date,
            'delete',
            jsonb_build_object('punch_type', v_old.punch_type, 'punched_at', v_old.punched_at),
            null,
            btrim(p_reason), p_edited_by
        );
        return p_punch_id;
    end if;

    raise exception 'invalid action %', p_action;
end;
$$;

revoke execute on function public.hr_admin_correct_punch(text, uuid, uuid, text, timestamptz, text, uuid) from public, anon, authenticated;
grant execute on function public.hr_admin_correct_punch(text, uuid, uuid, text, timestamptz, text, uuid) to service_role;

notify pgrst, 'reload schema';
