// ─── GET /api/cron/facturacion/retry-queue ────────────────────────────
// Vercel cron entry — re-attempts fe_documentos that errored on the
// initial /recepcion POST. The orchestrator's reintentarEnvio() handles
// the actual resend logic (re-signs if needed, sends, polls).
//
// Schedule:
//   { "path": "/api/cron/facturacion/retry-queue", "schedule": "* /15 * * *" }

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { reintentarEnvio } from '@/lib/facturacion/services/invoice-service';

export const maxDuration = 300;
export const runtime = 'nodejs';

const MAX_PER_RUN = 20;
const MAX_RETRIES = 5;

function unauthorized(req: NextRequest): boolean {
    const expected = process.env.CRON_SECRET;
    if (!expected) return false;
    const got = req.headers.get('authorization') || '';
    return got !== `Bearer ${expected}`;
}

const feFrom = (
    supabase: ReturnType<typeof createAdminClient>,
    table: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => (supabase as unknown as any).from(table);

export async function GET(req: NextRequest) {
    if (unauthorized(req)) {
        return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    }
    try {
        const supabase = createAdminClient();
        // Take the oldest-error docs that haven't exhausted their retries.
        const { data: docs, error } = await feFrom(supabase, 'fe_documentos')
            .select('id, clave, intentos_envio')
            .eq('estado_envio', 'error')
            .lt('intentos_envio', MAX_RETRIES)
            .order('ultimo_intento_at', { ascending: true, nullsFirst: true })
            .limit(MAX_PER_RUN);
        if (error) throw error;

        const results: Array<{
            documento_id: string;
            clave: string;
            ok: boolean;
            error?: string;
            estado?: string;
        }> = [];

        for (const doc of (docs || []) as Array<{
            id: string;
            clave: string;
        }>) {
            try {
                const r = await reintentarEnvio(doc.id);
                results.push({
                    documento_id: doc.id,
                    clave: doc.clave,
                    ok: r.success,
                    estado: r.estado_hacienda,
                    error: r.error
                });
            } catch (e) {
                results.push({
                    documento_id: doc.id,
                    clave: doc.clave,
                    ok: false,
                    error: e instanceof Error ? e.message : String(e)
                });
            }
        }

        return NextResponse.json({
            ok: true,
            scanned: results.length,
            succeeded: results.filter((r) => r.ok).length,
            failed: results.filter((r) => !r.ok).length,
            results
        });
    } catch (e) {
        console.error('[cron retry-queue] failed:', e);
        return NextResponse.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 }
        );
    }
}
