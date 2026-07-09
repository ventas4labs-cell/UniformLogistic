'use server';

import { createClient } from '@/utils/supabase/server';
import { isAdminEmail } from '@/lib/admin-acting-company';
import {
    sendOverdueReminders,
    type OverdueReminderResult
} from '@/lib/email/notifications';

export interface OverdueReminderActionResult extends OverdueReminderResult {
    error?: string;
}

// Admin clicks "Enviar recordatorios": emails every company that has an
// overdue invoice with a balance and an email on file. Gated to the
// admin because a server action can be invoked from anywhere.
export async function sendOverdueRemindersAction(): Promise<OverdueReminderActionResult> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!isAdminEmail(user?.email)) {
        return {
            sent: 0,
            skippedNoEmail: 0,
            failed: 0,
            companiesWithOverdue: 0,
            error: 'No autorizado.'
        };
    }
    try {
        return await sendOverdueReminders(supabase);
    } catch (e) {
        return {
            sent: 0,
            skippedNoEmail: 0,
            failed: 0,
            companiesWithOverdue: 0,
            error: e instanceof Error ? e.message : 'Error al enviar recordatorios.'
        };
    }
}
