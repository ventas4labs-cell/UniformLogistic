// ─── Polling service — resolve `procesando` documents ────────────────
// Sweeps fe_documentos where estado_hacienda is 'procesando' or
// estado_envio is 'enviado' but no terminal verdict yet. Calls Hacienda's
// /recepcion/{clave} once per doc and updates the row when Hacienda
// returns aceptado / aceptado_parcial / rechazado.
//
// Designed to be called from a Vercel cron every 2–5 minutes. Bounded by
// MAX_PER_RUN to keep one run inside the function timeout even on a
// large backlog.

import 'server-only';
import { createAdminClient } from '@/lib/supabase-admin';
import { consultarDocumento } from '../api/hacienda-client';
import { getHaciendaToken } from '../auth/hacienda-oauth';
import { deliverAcceptedDocument } from './delivery-service';

const MAX_PER_RUN = 50;

const feFrom = (
    supabase: ReturnType<typeof createAdminClient>,
    table: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => (supabase as unknown as any).from(table);

function mapIndEstado(indEstado: string): { estado: string | null; mensaje: string } {
    const key = (indEstado || '').toLowerCase().trim();
    const map: Record<string, { estado: string | null; mensaje: string }> = {
        '1': { estado: 'aceptado', mensaje: 'Aceptado por Hacienda' },
        '2': { estado: 'aceptado_parcial', mensaje: 'Aceptado parcialmente por Hacienda' },
        '3': { estado: 'rechazado', mensaje: 'Rechazado por Hacienda' },
        aceptado: { estado: 'aceptado', mensaje: 'Aceptado por Hacienda' },
        'aceptado parcial': {
            estado: 'aceptado_parcial',
            mensaje: 'Aceptado parcialmente por Hacienda'
        },
        rechazado: { estado: 'rechazado', mensaje: 'Rechazado por Hacienda' },
        procesando: { estado: null, mensaje: 'Procesando en Hacienda' }
    };
    return map[key] || { estado: null, mensaje: `Estado desconocido: ${indEstado}` };
}

export interface PollSweepResult {
    scanned: number;
    resolved: number;
    stillProcessing: number;
    errored: number;
    details: Array<{
        documento_id: string;
        clave: string;
        outcome: 'aceptado' | 'aceptado_parcial' | 'rechazado' | 'procesando' | 'error';
        message?: string;
    }>;
}

/**
 * Sweep `procesando` / `enviado` documents and resolve their final
 * Hacienda verdict. Token-per-branch is cached so this is cheap even
 * across many docs.
 */
export async function sweepProcesandoDocuments(): Promise<PollSweepResult> {
    const supabase = createAdminClient();

    // Pull the candidate set. `procesando` is the primary; we also
    // re-check `enviado` rows older than 30 s in case the initial
    // in-process poll never updated them.
    const cutoff = new Date(Date.now() - 30 * 1000).toISOString();
    const { data: docs, error } = await feFrom(supabase, 'fe_documentos')
        .select(
            'id, branch_id, clave, estado_hacienda, estado_envio, ultimo_intento_at, intentos_envio'
        )
        .or(
            `estado_hacienda.eq.procesando,and(estado_envio.eq.enviado,ultimo_intento_at.lt.${cutoff})`
        )
        .order('ultimo_intento_at', { ascending: true, nullsFirst: true })
        .limit(MAX_PER_RUN);
    if (error) throw error;

    const result: PollSweepResult = {
        scanned: docs?.length ?? 0,
        resolved: 0,
        stillProcessing: 0,
        errored: 0,
        details: []
    };

    // Token cache per branch so we don't re-auth per document.
    const tokenCache = new Map<string, string>();

    for (const doc of (docs || []) as Array<{
        id: string;
        branch_id: string;
        clave: string;
    }>) {
        try {
            let token = tokenCache.get(doc.branch_id);
            if (!token) {
                const t = await getHaciendaToken(doc.branch_id);
                token = t.access_token;
                tokenCache.set(doc.branch_id, token);
            }

            // Resolve environment off fe_config.
            const { data: cfg } = await feFrom(supabase, 'fe_config')
                .select('environment')
                .eq('branch_id', doc.branch_id)
                .single();
            const environment = (cfg?.environment ?? 'staging') as
                | 'staging'
                | 'production';

            const poll = await consultarDocumento({
                clave: doc.clave,
                token,
                environment
            });
            if (!poll) {
                // 404 from Hacienda — still processing.
                result.stillProcessing += 1;
                result.details.push({
                    documento_id: doc.id,
                    clave: doc.clave,
                    outcome: 'procesando'
                });
                await feFrom(supabase, 'fe_documentos')
                    .update({
                        estado_hacienda: 'procesando',
                        ultimo_intento_at: new Date().toISOString()
                    })
                    .eq('id', doc.id);
                continue;
            }

            const { estado, mensaje } = mapIndEstado(poll['ind-estado']);
            if (!estado) {
                result.stillProcessing += 1;
                result.details.push({
                    documento_id: doc.id,
                    clave: doc.clave,
                    outcome: 'procesando',
                    message: mensaje
                });
                continue;
            }

            await feFrom(supabase, 'fe_documentos')
                .update({
                    estado_hacienda: estado,
                    estado_envio: 'confirmado',
                    xml_respuesta_hacienda: poll['respuesta-xml'] || null,
                    mensaje_hacienda: mensaje,
                    ultimo_intento_at: new Date().toISOString()
                })
                .eq('id', doc.id);

            if (estado === 'aceptado' || estado === 'aceptado_parcial') {
                // Fire-and-forget delivery. Don't block the sweep on it.
                deliverAcceptedDocument(doc.id).catch((e: unknown) =>
                    console.error('[FE sweep] delivery failed:', e)
                );
            }

            result.resolved += 1;
            result.details.push({
                documento_id: doc.id,
                clave: doc.clave,
                outcome: estado as 'aceptado' | 'aceptado_parcial' | 'rechazado'
            });
        } catch (e) {
            result.errored += 1;
            result.details.push({
                documento_id: doc.id,
                clave: doc.clave,
                outcome: 'error',
                message: e instanceof Error ? e.message : String(e)
            });
            // Don't break — the next doc may succeed.
        }
    }

    return result;
}
