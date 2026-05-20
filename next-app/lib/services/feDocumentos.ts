// ─── fe_documentos service — admin read + filters ─────────────────────
// One place to load fe_documentos rows for the admin dashboard, with
// status mapping + lightweight typing so the page/client component
// don't have to know about the eslint escape hatch.

import 'server-only';
import { createAdminClient } from '@/lib/supabase-admin';

export type FeEstadoHacienda =
    | 'pendiente'
    | 'procesando'
    | 'aceptado'
    | 'aceptado_parcial'
    | 'rechazado'
    | 'error';
export type FeEstadoEnvio = 'no_enviado' | 'enviado' | 'confirmado' | 'error';

export interface FeDocumentoRow {
    id: string;
    branch_id: string;
    order_id: string | null;
    clave: string;
    consecutivo: string;
    tipo_documento: '01' | '02' | '03' | '04' | '08' | '10';
    fecha_emision: string;
    emisor_nombre: string;
    emisor_cedula: string;
    receptor_nombre: string | null;
    receptor_cedula: string | null;
    total_comprobante: number;
    total_impuesto: number;
    total_descuentos: number;
    estado_hacienda: FeEstadoHacienda;
    estado_envio: FeEstadoEnvio;
    mensaje_hacienda: string | null;
    intentos_envio: number | null;
    ultimo_intento_at: string | null;
    created_at: string;
    /** Joined order_number when an order_id is present. */
    order_number: number | null;
}

export interface FeDocumentoFilters {
    estado?: FeEstadoHacienda | 'todos';
    tipo?: FeDocumentoRow['tipo_documento'] | 'todos';
    /** Free-text search against clave / consecutivo / receptor_nombre. */
    q?: string;
    limit?: number;
}

const feFrom = (
    supabase: ReturnType<typeof createAdminClient>,
    table: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => (supabase as unknown as any).from(table);

export async function fetchFeDocumentos(
    filters: FeDocumentoFilters = {}
): Promise<FeDocumentoRow[]> {
    const supabase = createAdminClient();
    const limit = filters.limit ?? 200;

    let q = feFrom(supabase, 'fe_documentos')
        .select(
            `
            id, branch_id, order_id, clave, consecutivo, tipo_documento, fecha_emision,
            emisor_nombre, emisor_cedula, receptor_nombre, receptor_cedula,
            total_comprobante, total_impuesto, total_descuentos,
            estado_hacienda, estado_envio, mensaje_hacienda,
            intentos_envio, ultimo_intento_at, created_at,
            order:orders ( order_number )
            `
        )
        .order('created_at', { ascending: false })
        .limit(limit);

    if (filters.estado && filters.estado !== 'todos') {
        q = q.eq('estado_hacienda', filters.estado);
    }
    if (filters.tipo && filters.tipo !== 'todos') {
        q = q.eq('tipo_documento', filters.tipo);
    }
    if (filters.q && filters.q.trim()) {
        const term = filters.q.trim();
        // Search across clave (numeric), consecutivo, receptor name.
        q = q.or(
            `clave.ilike.%${term}%,consecutivo.ilike.%${term}%,receptor_nombre.ilike.%${term}%`
        );
    }

    const { data, error } = await q;
    if (error) throw error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data || []) as any[]).map((r): FeDocumentoRow => {
        const order = Array.isArray(r.order) ? r.order[0] : r.order;
        return {
            id: r.id,
            branch_id: r.branch_id,
            order_id: r.order_id ?? null,
            clave: r.clave,
            consecutivo: r.consecutivo,
            tipo_documento: r.tipo_documento,
            fecha_emision: r.fecha_emision,
            emisor_nombre: r.emisor_nombre,
            emisor_cedula: r.emisor_cedula,
            receptor_nombre: r.receptor_nombre ?? null,
            receptor_cedula: r.receptor_cedula ?? null,
            total_comprobante: Number(r.total_comprobante ?? 0),
            total_impuesto: Number(r.total_impuesto ?? 0),
            total_descuentos: Number(r.total_descuentos ?? 0),
            estado_hacienda: r.estado_hacienda,
            estado_envio: r.estado_envio,
            mensaje_hacienda: r.mensaje_hacienda ?? null,
            intentos_envio: r.intentos_envio ?? null,
            ultimo_intento_at: r.ultimo_intento_at ?? null,
            created_at: r.created_at,
            order_number: order?.order_number ?? null
        };
    });
}

export interface FeDocumentosSummary {
    total: number;
    aceptados: number;
    rechazados: number;
    procesando: number;
    pendientes: number;
    error: number;
    totalFacturado: number;
}

export function summarizeFeDocumentos(rows: FeDocumentoRow[]): FeDocumentosSummary {
    let aceptados = 0,
        rechazados = 0,
        procesando = 0,
        pendientes = 0,
        error = 0,
        totalFacturado = 0;
    for (const r of rows) {
        if (r.estado_hacienda === 'aceptado' || r.estado_hacienda === 'aceptado_parcial') {
            aceptados += 1;
            totalFacturado += r.total_comprobante;
        } else if (r.estado_hacienda === 'rechazado') rechazados += 1;
        else if (r.estado_hacienda === 'procesando') procesando += 1;
        else if (r.estado_hacienda === 'pendiente') pendientes += 1;
        else if (r.estado_hacienda === 'error') error += 1;
    }
    return { total: rows.length, aceptados, rechazados, procesando, pendientes, error, totalFacturado };
}
