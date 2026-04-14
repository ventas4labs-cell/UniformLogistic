// ─── fe_config service ────────────────────────────────────────────────────
// Loads/saves the single seller fe_config row (one branch).

import 'server-only';
import { createAdminClient } from '@/lib/supabase-admin';
import { encrypt } from '@/lib/facturacion/crypto/encryption';

export interface FeConfigForm {
    branchId?: string;
    environment: 'staging' | 'production';
    cedulaTipo: string;
    cedulaNumero: string;
    nombreEmisor: string;
    nombreComercial: string;
    codigoActividad: string;
    sucursal: string;
    puntoVenta: string;
    correoEmisor: string;
    telefonoEmisor: string;
    provincia: string;
    canton: string;
    distrito: string;
    barrio: string;
    otrasSenas: string;
    haciendaUsername: string;
    haciendaPassword: string; // plaintext input — encrypted before save
    p12CertificatePath: string;
    p12Pin: string; // plaintext input — encrypted before save (empty = leave existing)
}

export interface FeConfigRow {
    id: string;
    branch_id: string;
    environment: 'staging' | 'production';
    cedula_tipo: string;
    cedula_numero: string;
    nombre_emisor: string;
    nombre_comercial: string | null;
    codigo_actividad: string;
    sucursal: string;
    punto_venta: string;
    correo_emisor: string | null;
    telefono_emisor: string | null;
    provincia: string | null;
    canton: string | null;
    distrito: string | null;
    barrio: string | null;
    otras_senas: string | null;
    hacienda_username: string;
    hacienda_password_encrypted: string;
    p12_certificate_path: string | null;
    p12_pin_encrypted: string | null;
}

// Single-tenant: hard-coded branch UUID for this Uniform Logistic deployment.
// Stored once in fe_config; orders inherit it.
export const DEFAULT_BRANCH_ID = '00000000-0000-0000-0000-000000000001';

export async function fetchFeConfig(): Promise<FeConfigRow | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('fe_config')
        .select('*')
        .eq('branch_id', DEFAULT_BRANCH_ID)
        .maybeSingle();
    if (error) throw error;
    return (data as FeConfigRow | null) ?? null;
}

export async function saveFeConfig(input: FeConfigForm): Promise<void> {
    const supabase = createAdminClient();
    const branchId = input.branchId || DEFAULT_BRANCH_ID;

    // Encrypt secrets when provided. If pin/password is empty, keep existing row's value.
    const existing = await supabase
        .from('fe_config')
        .select('hacienda_password_encrypted, p12_pin_encrypted')
        .eq('branch_id', branchId)
        .maybeSingle();
    const existingRow = existing.data as { hacienda_password_encrypted: string | null; p12_pin_encrypted: string | null } | null;

    const passwordEncrypted = input.haciendaPassword
        ? encrypt(input.haciendaPassword)
        : existingRow?.hacienda_password_encrypted || '';
    const pinEncrypted = input.p12Pin
        ? encrypt(input.p12Pin)
        : existingRow?.p12_pin_encrypted || null;

    const payload = {
        branch_id: branchId,
        environment: input.environment,
        cedula_tipo: input.cedulaTipo,
        cedula_numero: input.cedulaNumero,
        nombre_emisor: input.nombreEmisor,
        nombre_comercial: input.nombreComercial || null,
        codigo_actividad: input.codigoActividad,
        sucursal: input.sucursal || '001',
        punto_venta: input.puntoVenta || '00001',
        correo_emisor: input.correoEmisor || null,
        telefono_emisor: input.telefonoEmisor || null,
        provincia: input.provincia || null,
        canton: input.canton || null,
        distrito: input.distrito || null,
        barrio: input.barrio || null,
        otras_senas: input.otrasSenas || null,
        hacienda_username: input.haciendaUsername,
        hacienda_password_encrypted: passwordEncrypted,
        p12_certificate_path: input.p12CertificatePath || null,
        p12_pin_encrypted: pinEncrypted,
        updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('fe_config').upsert(payload, { onConflict: 'branch_id' });
    if (error) throw error;
}

export async function uploadCertificate(file: File): Promise<string> {
    const supabase = createAdminClient();
    const ext = file.name.split('.').pop() || 'p12';
    const path = `${DEFAULT_BRANCH_ID}/cert-${Date.now()}.${ext}`;
    const buffer = await file.arrayBuffer();
    const { error } = await supabase.storage
        .from('certificates')
        .upload(path, new Uint8Array(buffer), { upsert: true, contentType: 'application/x-pkcs12' });
    if (error) throw error;
    return path;
}

export interface FeDocumentoRow {
    id: string;
    clave: string;
    consecutivo: string;
    tipo_documento: string;
    fecha_emision: string;
    receptor_nombre: string | null;
    total_comprobante: number;
    estado_hacienda: string;
    estado_envio: string;
    mensaje_hacienda: string | null;
    order_id: string | null;
    created_at: string;
}

export async function fetchFeDocumentos(limit = 50): Promise<FeDocumentoRow[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('fe_documentos')
        .select('id, clave, consecutivo, tipo_documento, fecha_emision, receptor_nombre, total_comprobante, estado_hacienda, estado_envio, mensaje_hacienda, order_id, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return (data || []) as FeDocumentoRow[];
}
