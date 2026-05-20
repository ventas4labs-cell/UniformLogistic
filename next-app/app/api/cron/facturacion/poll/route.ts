// ─── GET /api/cron/facturacion/poll ───────────────────────────────────
// Vercel cron entry — sweeps fe_documentos that are still `procesando`
// or `enviado-without-verdict` and asks Hacienda for their final state.
// See PRODUCT_STOCK_DICTATION.md siblings (FACTURACION_MODULE) §8.3.
//
// Schedule (configure in vercel.json):
//   { "path": "/api/cron/facturacion/poll", "schedule": "* /3 * * *" }
//
// Auth: requires `Authorization: Bearer ${CRON_SECRET}`. Vercel sets
// this automatically for crons configured under vercel.json; manual
// callers must supply the same header.

import { NextRequest, NextResponse } from 'next/server';
import { sweepProcesandoDocuments } from '@/lib/facturacion/services/polling-service';

export const maxDuration = 300;
export const runtime = 'nodejs';

function unauthorized(req: NextRequest): boolean {
    const expected = process.env.CRON_SECRET;
    if (!expected) return false; // dev convenience — disable gate when not configured
    const got = req.headers.get('authorization') || '';
    return got !== `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
    if (unauthorized(req)) {
        return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    }
    try {
        const result = await sweepProcesandoDocuments();
        return NextResponse.json({ ok: true, ...result });
    } catch (e) {
        console.error('[cron poll] sweep failed:', e);
        return NextResponse.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 }
        );
    }
}
