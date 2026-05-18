'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import type { FeConfigForm as FeConfigFormType, FeConfigRow } from '@/lib/services/feConfig';
import { saveFeConfigAction, uploadCertificateAction } from '@/app/(admin)/admin/facturacion/actions';

const emptyForm: FeConfigFormType = {
    environment: 'staging',
    cedulaTipo: '02',
    cedulaNumero: '',
    nombreEmisor: '',
    nombreComercial: '',
    codigoActividad: '',
    sucursal: '001',
    puntoVenta: '00001',
    correoEmisor: '',
    telefonoEmisor: '',
    provincia: '',
    canton: '',
    distrito: '',
    barrio: '',
    otrasSenas: '',
    haciendaUsername: '',
    haciendaPassword: '',
    p12CertificatePath: '',
    p12Pin: ''
};

function rowToForm(row: FeConfigRow | null): FeConfigFormType {
    if (!row) return emptyForm;
    return {
        branchId: row.branch_id,
        environment: row.environment,
        cedulaTipo: row.cedula_tipo,
        cedulaNumero: row.cedula_numero,
        nombreEmisor: row.nombre_emisor,
        nombreComercial: row.nombre_comercial || '',
        codigoActividad: row.codigo_actividad,
        sucursal: row.sucursal,
        puntoVenta: row.punto_venta,
        correoEmisor: row.correo_emisor || '',
        telefonoEmisor: row.telefono_emisor || '',
        provincia: row.provincia || '',
        canton: row.canton || '',
        distrito: row.distrito || '',
        barrio: row.barrio || '',
        otrasSenas: row.otras_senas || '',
        haciendaUsername: row.hacienda_username,
        haciendaPassword: '', // always blank — existing value preserved server-side if blank
        p12CertificatePath: row.p12_certificate_path || '',
        p12Pin: ''
    };
}

export function FeConfigForm({ initialConfig }: { initialConfig: FeConfigRow | null }) {
    const router = useRouter();
    const [form, setForm] = useState<FeConfigFormType>(rowToForm(initialConfig));
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const hasConfig = Boolean(initialConfig);
    const hasCert = Boolean(form.p12CertificatePath);

    const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setStatus(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const path = await uploadCertificateAction(fd);
            setForm((f) => ({ ...f, p12CertificatePath: path }));
            setStatus({ type: 'success', text: `Certificado subido: ${path.split('/').pop()}` });
        } catch (err) {
            setStatus({ type: 'error', text: err instanceof Error ? err.message : 'Error al subir certificado' });
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setStatus(null);
        try {
            await saveFeConfigAction(form);
            setStatus({ type: 'success', text: 'Configuración guardada correctamente.' });
            setForm((f) => ({ ...f, haciendaPassword: '', p12Pin: '' }));
            router.refresh();
        } catch (err) {
            setStatus({ type: 'error', text: err instanceof Error ? err.message : 'Error al guardar' });
        } finally {
            setSaving(false);
        }
    };

    const update = <K extends keyof FeConfigFormType>(key: K, value: FeConfigFormType[K]) => {
        setForm((f) => ({ ...f, [key]: value }));
    };

    return (
        <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Configuración del Emisor</h3>
                <span
                    className={`text-xs font-bold px-3 py-1 rounded-full ${
                        hasConfig
                            ? 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300'
                            : 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300'
                    }`}
                >
                    {hasConfig ? 'Configurado' : 'Sin configurar'}
                </span>
            </div>

            {/* Ambiente */}
            <Section title="Ambiente">
                <div className="flex gap-2">
                    {(['staging', 'production'] as const).map((env) => (
                        <button
                            key={env}
                            type="button"
                            onClick={() => update('environment', env)}
                            className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm border transition-colors ${
                                form.environment === env
                                    ? 'bg-orange-600 text-white border-orange-600'
                                    : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-gray-300 dark:border-zinc-700 hover:border-orange-400'
                            }`}
                        >
                            {env === 'staging' ? 'Pruebas (staging)' : 'Producción'}
                        </button>
                    ))}
                </div>
            </Section>

            {/* Datos del emisor */}
            <Section title="Datos del Emisor">
                <Grid cols={2}>
                    <Field label="Tipo de Cédula *">
                        <select
                            required
                            value={form.cedulaTipo}
                            onChange={(e) => update('cedulaTipo', e.target.value)}
                            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            <option value="01">01 — Física</option>
                            <option value="02">02 — Jurídica</option>
                            <option value="03">03 — DIMEX</option>
                            <option value="04">04 — NITE</option>
                            <option value="05">05 — Extranjero</option>
                        </select>
                    </Field>
                    <Field label="Número de Cédula *">
                        <input
                            required
                            type="text"
                            value={form.cedulaNumero}
                            onChange={(e) => update('cedulaNumero', e.target.value.replace(/\D/g, ''))}
                            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                            placeholder="3101123456"
                        />
                    </Field>
                </Grid>
                <Field label="Nombre / Razón Social *">
                    <input
                        required
                        type="text"
                        value={form.nombreEmisor}
                        onChange={(e) => update('nombreEmisor', e.target.value)}
                        className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </Field>
                <Field label="Nombre Comercial">
                    <input
                        type="text"
                        value={form.nombreComercial}
                        onChange={(e) => update('nombreComercial', e.target.value)}
                        className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </Field>
                <Grid cols={3}>
                    <Field label="Código Actividad *">
                        <input
                            required
                            type="text"
                            value={form.codigoActividad}
                            onChange={(e) => update('codigoActividad', e.target.value.replace(/\D/g, ''))}
                            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                            placeholder="722003"
                        />
                    </Field>
                    <Field label="Sucursal">
                        <input
                            type="text"
                            value={form.sucursal}
                            onChange={(e) => update('sucursal', e.target.value.replace(/\D/g, '').padStart(3, '0').slice(-3))}
                            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                            placeholder="001"
                        />
                    </Field>
                    <Field label="Punto de Venta">
                        <input
                            type="text"
                            value={form.puntoVenta}
                            onChange={(e) => update('puntoVenta', e.target.value.replace(/\D/g, '').padStart(5, '0').slice(-5))}
                            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                            placeholder="00001"
                        />
                    </Field>
                </Grid>
                <Grid cols={2}>
                    <Field label="Correo">
                        <input
                            type="email"
                            value={form.correoEmisor}
                            onChange={(e) => update('correoEmisor', e.target.value)}
                            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </Field>
                    <Field label="Teléfono">
                        <input
                            type="tel"
                            value={form.telefonoEmisor}
                            onChange={(e) => update('telefonoEmisor', e.target.value)}
                            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </Field>
                </Grid>
            </Section>

            {/* Ubicación */}
            <Section title="Ubicación">
                <Grid cols={4}>
                    <Field label="Provincia">
                        <input
                            type="text"
                            value={form.provincia}
                            onChange={(e) => update('provincia', e.target.value)}
                            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="San José"
                        />
                    </Field>
                    <Field label="Cantón">
                        <input
                            type="text"
                            value={form.canton}
                            onChange={(e) => update('canton', e.target.value)}
                            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </Field>
                    <Field label="Distrito">
                        <input
                            type="text"
                            value={form.distrito}
                            onChange={(e) => update('distrito', e.target.value)}
                            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </Field>
                    <Field label="Barrio">
                        <input
                            type="text"
                            value={form.barrio}
                            onChange={(e) => update('barrio', e.target.value)}
                            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </Field>
                </Grid>
                <Field label="Otras señas">
                    <textarea
                        value={form.otrasSenas}
                        onChange={(e) => update('otrasSenas', e.target.value)}
                        rows={2}
                        className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </Field>
            </Section>

            {/* Credenciales Hacienda */}
            <Section title="Credenciales ATV (Hacienda)">
                <Grid cols={2}>
                    <Field label="Usuario ATV *">
                        <input
                            required
                            type="text"
                            value={form.haciendaUsername}
                            onChange={(e) => update('haciendaUsername', e.target.value)}
                            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                            placeholder="cpf-..."
                        />
                    </Field>
                    <Field
                        label={
                            hasConfig
                                ? 'Contraseña ATV (dejar vacío para conservar)'
                                : 'Contraseña ATV *'
                        }
                    >
                        <input
                            required={!hasConfig}
                            type="password"
                            value={form.haciendaPassword}
                            onChange={(e) => update('haciendaPassword', e.target.value)}
                            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder={hasConfig ? '••••••••' : ''}
                        />
                    </Field>
                </Grid>
            </Section>

            {/* Certificado .p12 */}
            <Section title="Llave Criptográfica (.p12)">
                <div className="flex items-start gap-4">
                    <label className="flex-1">
                        <div className="flex items-center gap-2 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg p-4 cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                            {uploading ? (
                                <Loader2 className="animate-spin text-gray-400 dark:text-zinc-500" size={20} />
                            ) : hasCert ? (
                                <CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />
                            ) : (
                                <Upload className="text-gray-400 dark:text-zinc-500" size={20} />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
                                    {hasCert ? 'Certificado cargado' : 'Subir archivo .p12'}
                                </div>
                                {hasCert && (
                                    <div className="text-xs text-gray-500 dark:text-zinc-400 font-mono truncate">
                                        {form.p12CertificatePath}
                                    </div>
                                )}
                            </div>
                        </div>
                        <input
                            type="file"
                            accept=".p12,application/x-pkcs12"
                            onChange={handleCertUpload}
                            disabled={uploading}
                            className="hidden"
                        />
                    </label>
                </div>
                <Field
                    label={
                        hasConfig
                            ? 'PIN del certificado (dejar vacío para conservar)'
                            : 'PIN del certificado *'
                    }
                >
                    <input
                        required={!hasConfig && !form.p12CertificatePath ? false : !hasConfig}
                        type="password"
                        value={form.p12Pin}
                        onChange={(e) => update('p12Pin', e.target.value)}
                        className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder={hasConfig ? '••••••••' : ''}
                    />
                </Field>
            </Section>

            {/* Status */}
            {status && (
                <div
                    className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
                        status.type === 'success'
                            ? 'bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-900/60'
                            : 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900/60'
                    }`}
                >
                    {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {status.text}
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-zinc-800">
                <button
                    type="submit"
                    disabled={saving}
                    className="bg-orange-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-orange-700 disabled:bg-gray-300 flex items-center gap-2 shadow-md"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Guardar configuración
                </button>
            </div>
        </form>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <h4 className="text-sm font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">{title}</h4>
            <div className="space-y-3">{children}</div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{label}</label>
            {children}
        </div>
    );
}

function Grid({ cols, children }: { cols: 2 | 3 | 4; children: React.ReactNode }) {
    const cls = cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4';
    return <div className={`grid ${cls} gap-3`}>{children}</div>;
}
