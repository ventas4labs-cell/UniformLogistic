'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase-admin';
import { consultarDocumento } from '@/lib/facturacion/api/hacienda-client';
import { getHaciendaToken } from '@/lib/facturacion/auth/hacienda-oauth';
import { reintentarEnvio } from '@/lib/facturacion/services/invoice-service';
import { deliverAcceptedDocument } from '@/lib/facturacion/services/delivery-service';

const feFrom = (
    supabase: ReturnType<typeof createAdminClient>,
    table: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => (supabase as unknown as any).from(table);

function mapIndEstado(
    indEstado: string
): { estado: string | null; mensaje: string } {
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

export interface ConsultarResult {
    success: boolean;
    estado_hacienda?: string;
    mensaje?: string;
    error?: string;
}

/**
 * Force-consult Hacienda for a single document — used by the admin
 * documents page when an operator wants to know NOW if something
 * resolved.
 */
export async function consultarDocumentoAction(
    documentoId: string
): Promise<ConsultarResult> {
    try {
        const supabase = createAdminClient();
        const { data: doc, error } = await feFrom(supabase, 'fe_documentos')
            .select('id, branch_id, clave')
            .eq('id', documentoId)
            .single();
        if (error || !doc) return { success: false, error: 'documento no encontrado' };

        const token = await getHaciendaToken(doc.branch_id);
        const { data: cfg } = await feFrom(supabase, 'fe_config')
            .select('environment')
            .eq('branch_id', doc.branch_id)
            .single();
        const environment = (cfg?.environment ?? 'staging') as 'staging' | 'production';

        const poll = await consultarDocumento({
            clave: doc.clave,
            token: token.access_token,
            environment
        });
        if (!poll) {
            await feFrom(supabase, 'fe_documentos')
                .update({
                    estado_hacienda: 'procesando',
                    ultimo_intento_at: new Date().toISOString()
                })
                .eq('id', documentoId);
            revalidatePath('/admin/facturacion');
            return { success: true, estado_hacienda: 'procesando', mensaje: 'Hacienda todavía procesando' };
        }
        const { estado, mensaje } = mapIndEstado(poll['ind-estado']);
        if (!estado) {
            revalidatePath('/admin/facturacion');
            return { success: true, estado_hacienda: 'procesando', mensaje };
        }
        await feFrom(supabase, 'fe_documentos')
            .update({
                estado_hacienda: estado,
                estado_envio: 'confirmado',
                xml_respuesta_hacienda: poll['respuesta-xml'] || null,
                mensaje_hacienda: mensaje,
                ultimo_intento_at: new Date().toISOString()
            })
            .eq('id', documentoId);

        if (estado === 'aceptado' || estado === 'aceptado_parcial') {
            deliverAcceptedDocument(documentoId).catch((e: unknown) =>
                console.error('[FE consult action] delivery failed:', e)
            );
        }

        revalidatePath('/admin/facturacion');
        return { success: true, estado_hacienda: estado, mensaje };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
}

export async function reintentarEnvioAction(
    documentoId: string
): Promise<ConsultarResult> {
    try {
        const r = await reintentarEnvio(documentoId);
        revalidatePath('/admin/facturacion');
        return { success: r.success, estado_hacienda: r.estado_hacienda, error: r.error };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
}
