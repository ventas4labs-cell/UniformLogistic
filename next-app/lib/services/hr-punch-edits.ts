import type { SupabaseClient } from '@supabase/supabase-js';
import type { PunchType } from './hr-punches';

// ─── Admin punch corrections + audit trail ──────────────────────────
// Employees can't change their time. The admin adds, edits or deletes a
// marcaje through hr_admin_correct_punch (service role only), which
// writes the change and its hr_punch_edits row in one transaction.

export type PunchEditAction = 'create' | 'update' | 'delete';

export const EDIT_ACTION_LABELS: Record<PunchEditAction, string> = {
    create: 'Agregado',
    update: 'Modificado',
    delete: 'Eliminado'
};

interface PunchSnapshot {
    punchType: PunchType;
    punchedAt: string;
}

export interface PunchEdit {
    id: string;
    punchId: string;
    action: PunchEditAction;
    before: PunchSnapshot | null;
    after: PunchSnapshot | null;
    reason: string;
    editedAt: string;
}

interface RawSnapshot {
    punch_type: PunchType;
    punched_at: string;
}

interface RawRow {
    id: string;
    punch_id: string;
    action: PunchEditAction;
    before: RawSnapshot | null;
    after: RawSnapshot | null;
    reason: string;
    edited_at: string;
}

const snap = (s: RawSnapshot | null): PunchSnapshot | null =>
    s ? { punchType: s.punch_type, punchedAt: s.punched_at } : null;

/** Corrections for one employee's CR day, newest first. */
export async function fetchPunchEditsForDay(
    supabase: SupabaseClient,
    employeeId: string,
    dateStr: string
): Promise<PunchEdit[]> {
    const { data, error } = await supabase
        .from('hr_punch_edits')
        .select('id, punch_id, action, before, after, reason, edited_at')
        .eq('employee_id', employeeId)
        .eq('work_date', dateStr)
        .order('edited_at', { ascending: false });
    if (error) {
        if ((error as { code?: string }).code === '42P01') return [];
        throw error;
    }
    return ((data || []) as RawRow[]).map((r) => ({
        id: r.id,
        punchId: r.punch_id,
        action: r.action,
        before: snap(r.before),
        after: snap(r.after),
        reason: r.reason,
        editedAt: r.edited_at
    }));
}

/** Apply one correction atomically (service-role client). */
export async function correctPunch(
    serviceSupabase: SupabaseClient,
    input: {
        action: PunchEditAction;
        employeeId: string;
        punchId: string | null;
        punchType: PunchType | null;
        punchedAt: string | null;
        reason: string;
        editedBy: string;
    }
): Promise<void> {
    const { error } = await serviceSupabase.rpc('hr_admin_correct_punch', {
        p_action: input.action,
        p_employee_id: input.employeeId,
        p_punch_id: input.punchId,
        p_punch_type: input.punchType,
        p_punched_at: input.punchedAt,
        p_reason: input.reason,
        p_edited_by: input.editedBy
    });
    if (error) throw error;
}
