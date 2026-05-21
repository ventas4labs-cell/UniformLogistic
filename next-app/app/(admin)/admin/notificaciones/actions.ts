'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { resolveReport, unresolveReport } from '@/lib/services/missing-insumos';

export async function resolveReportAction(reportId: string) {
    const supabase = await createClient();
    await resolveReport(supabase, reportId);
    revalidatePath('/admin/notificaciones');
}

export async function unresolveReportAction(reportId: string) {
    const supabase = await createClient();
    await unresolveReport(supabase, reportId);
    revalidatePath('/admin/notificaciones');
}
