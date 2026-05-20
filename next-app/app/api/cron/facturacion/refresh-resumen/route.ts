// ─── GET /api/cron/facturacion/refresh-resumen ─────────────────────────
// Nightly cron — recomputes fe_resumen_fiscal for the current month and
// the previous month, per branch. The previous-month refresh catches
// late documents that landed close to month boundary.
//
// Schedule:
//   { "path": "/api/cron/facturacion/refresh-resumen", "schedule": "0 3 * * *" }

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { DEFAULT_BRANCH_ID } from '@/lib/services/feConfig';

export const maxDuration = 120;
export const runtime = 'nodejs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const feFrom = (s: ReturnType<typeof createAdminClient>, t: string): any =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s as unknown as any).from(t);

function unauthorized(req: NextRequest): boolean {
    const expected = process.env.CRON_SECRET;
    if (!expected) return false;
    return req.headers.get('authorization') !== `Bearer ${expected}`;
}

function periodoFor(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
    if (unauthorized(req)) {
        return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Branches that have fe_config (i.e., are emitting). For now this
    // project is single-branch — DEFAULT_BRANCH_ID — but the cron is
    // already shaped to handle a multi-branch future.
    const { data: configs } = await feFrom(admin, 'fe_config')
        .select('branch_id');
    const branchIds: string[] =
        Array.isArray(configs) && configs.length > 0
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (configs as any[]).map((c) => String(c.branch_id))
            : [DEFAULT_BRANCH_ID];

    const now = new Date();
    const prevMonth = new Date(now);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const periodos = [periodoFor(prevMonth), periodoFor(now)];

    const results: Array<{
        branch_id: string;
        periodo: string;
        ok: boolean;
        error?: string;
    }> = [];
    for (const branchId of branchIds) {
        for (const periodo of periodos) {
            try {
                const { error } = await admin.rpc('refresh_resumen_fiscal', {
                    p_branch_id: branchId,
                    p_periodo: periodo
                });
                if (error) throw error;
                results.push({ branch_id: branchId, periodo, ok: true });
            } catch (e) {
                results.push({
                    branch_id: branchId,
                    periodo,
                    ok: false,
                    error: e instanceof Error ? e.message : String(e)
                });
            }
        }
    }

    return NextResponse.json({ ok: true, results });
}
