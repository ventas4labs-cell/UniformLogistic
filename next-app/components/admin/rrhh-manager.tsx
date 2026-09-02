'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    CalendarClock,
    Check,
    Clock,
    Copy,
    ExternalLink,
    Loader2,
    Mail,
    Monitor,
    Pencil,
    Plus,
    Power,
    PowerOff,
    RefreshCcw,
    Trash2,
    Users,
    X
} from 'lucide-react';
import type { Employee } from '@/lib/services/employees';
import type { Kiosk } from '@/lib/services/hr-kiosks';
import {
    DEFAULT_SCHEDULE,
    WEEKDAY_LABELS,
    type Schedule,
    type ScheduleInput
} from '@/lib/services/hr-schedules';
import {
    createEmployeeAction,
    createKioskAction,
    deleteEmployeeAction,
    deleteKioskAction,
    regenerateKioskTokenAction,
    resendEmployeeInviteAction,
    saveEmployeeScheduleAction,
    setEmployeeActiveAction,
    setKioskActiveAction,
    updateEmployeeAction,
    type CreateEmployeeInput
} from '@/app/(admin)/admin/rrhh/actions';
import { useDialog } from '@/lib/use-dialog';

type Status = 'active' | 'pending' | 'inactive';
type Tab = 'empleados' | 'kioscos';

function statusOf(e: Employee): Status {
    if (!e.isActive) return 'inactive';
    return e.activatedAt ? 'active' : 'pending';
}

const STATUS_META: Record<Status, { label: string; cls: string }> = {
    active: { label: 'Activo', cls: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300' },
    pending: { label: 'Invitación pendiente', cls: 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300' },
    inactive: { label: 'Inactivo', cls: 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400' }
};

const kioskUrl = (token: string) =>
    typeof window === 'undefined'
        ? `/rrhh/kiosko/${token}`
        : `${window.location.origin}/rrhh/kiosko/${token}`;

export function RrhhManager({
    initialEmployees,
    initialKiosks,
    initialSchedules
}: {
    initialEmployees: Employee[];
    initialKiosks: Kiosk[];
    initialSchedules: Record<string, Schedule>;
}) {
    const router = useRouter();
    // Rendered straight from props; every mutation calls router.refresh().
    const employees = initialEmployees;
    const kiosks = initialKiosks;
    const schedules = initialSchedules;

    const [tab, setTab] = useState<Tab>('empleados');
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState<Employee | null>(null);
    const [scheduling, setScheduling] = useState<Employee | null>(null);
    const [creatingKiosk, setCreatingKiosk] = useState(false);
    const [createdKioskUrl, setCreatedKioskUrl] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sentId, setSentId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const runAction = (fn: () => Promise<{ error?: string; warning?: string }>) =>
        startTransition(async () => {
            setError(null);
            const res = await fn();
            if (res?.error) setError(res.error);
            else {
                if (res?.warning) setNotice(res.warning);
                router.refresh();
            }
        });

    const handleResend = (e: Employee) =>
        startTransition(async () => {
            setError(null);
            const res = await resendEmployeeInviteAction(e.id);
            if (res?.error) setError(res.error);
            else {
                setSentId(e.id);
                setTimeout(() => setSentId(null), 2000);
                router.refresh();
            }
        });

    const handleDeleteEmployee = (e: Employee) => {
        if (!confirm(`¿Eliminar a ${e.fullName}? Se borra su cuenta y su historial de marcajes.`)) return;
        runAction(() => deleteEmployeeAction(e.id));
    };

    const handleCopyKiosk = async (k: Kiosk) => {
        try {
            await navigator.clipboard.writeText(kioskUrl(k.accessToken));
            setCopiedId(k.id);
            setTimeout(() => setCopiedId(null), 1500);
        } catch {
            prompt('Copiá el enlace del kiosco:', kioskUrl(k.accessToken));
        }
    };

    const handleRotateKiosk = (k: Kiosk) =>
        startTransition(async () => {
            setError(null);
            if (!confirm('¿Generar un enlace nuevo? El enlace anterior dejará de funcionar.')) return;
            const res = await regenerateKioskTokenAction(k.id);
            if (res?.error) setError(res.error);
            else router.refresh();
        });

    const handleDeleteKiosk = (k: Kiosk) => {
        if (!confirm(`¿Eliminar el kiosco “${k.label}”?`)) return;
        runAction(() => deleteKioskAction(k.id));
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <Users size={24} className="text-orange-600 dark:text-orange-400" />
                        Recursos Humanos
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Empleados y kioscos de marcaje por QR.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/admin/rrhh/asistencia"
                        className="bg-white dark:bg-zinc-900 border border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 px-4 py-2 rounded-lg font-bold hover:bg-orange-50 dark:hover:bg-orange-950/40 shadow-sm flex items-center gap-2"
                    >
                        <CalendarClock size={16} /> Asistencia
                    </Link>
                    {tab === 'empleados' ? (
                        <button
                            type="button"
                            onClick={() => {
                                setError(null);
                                setCreating(true);
                            }}
                            className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md flex items-center gap-2"
                        >
                            <Plus size={16} /> Nuevo empleado
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => {
                                setError(null);
                                setCreatingKiosk(true);
                            }}
                            className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md flex items-center gap-2"
                        >
                            <Plus size={16} /> Nuevo kiosco
                        </button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1 mb-6 border-b border-gray-200 dark:border-zinc-800">
                {(['empleados', 'kioscos'] as Tab[]).map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-colors ${
                            tab === t
                                ? 'border-orange-600 text-orange-700 dark:text-orange-400'
                                : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200'
                        }`}
                    >
                        {t === 'empleados' ? 'Empleados' : 'Kioscos'}
                    </button>
                ))}
            </div>

            {notice && (
                <div className="mb-4 flex items-start justify-between gap-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-3 rounded-lg text-sm border border-amber-200 dark:border-amber-900/50">
                    <span>{notice}</span>
                    <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar">
                        <X size={16} />
                    </button>
                </div>
            )}
            {error && (
                <div className="mb-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">
                    {error}
                </div>
            )}

            {tab === 'empleados' ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-x-auto border border-gray-200 dark:border-zinc-800">
                    {employees.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 dark:text-zinc-400">
                            Aún no hay empleados. Creá el primero con “Nuevo empleado”.
                        </div>
                    ) : (
                        <table className="w-full text-sm min-w-[720px]">
                            <thead className="bg-gray-50 dark:bg-zinc-900/60">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Empleado</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Puesto</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Estado</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {employees.map((e) => {
                                    const meta = STATUS_META[statusOf(e)];
                                    return (
                                        <tr key={e.id} className={e.isActive ? '' : 'opacity-60'}>
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-gray-900 dark:text-zinc-100">{e.fullName}</div>
                                                <div className="text-[11px] text-gray-500 dark:text-zinc-500 font-mono">{e.email}</div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-700 dark:text-zinc-300">{e.position || '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${meta.cls}`}>{meta.label}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="inline-flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleResend(e)}
                                                        disabled={pending}
                                                        title={e.activatedAt ? 'Reenviar enlace para restablecer contraseña' : 'Reenviar invitación'}
                                                        className={`p-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/40 ${
                                                            sentId === e.id ? 'text-green-600 dark:text-green-400' : 'text-gray-400 hover:text-orange-600 dark:hover:text-orange-400'
                                                        }`}
                                                    >
                                                        {sentId === e.id ? <Check size={14} /> : <Mail size={14} />}
                                                    </button>
                                                    <button type="button" onClick={() => { setError(null); setScheduling(e); }} disabled={pending} title="Horario" className="p-1.5 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg">
                                                        <Clock size={14} />
                                                    </button>
                                                    <button type="button" onClick={() => { setError(null); setEditing(e); }} disabled={pending} title="Editar" className="p-1.5 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg">
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button type="button" onClick={() => runAction(() => setEmployeeActiveAction(e.id, !e.isActive))} disabled={pending} title={e.isActive ? 'Desactivar' : 'Activar'} className="p-1.5 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg">
                                                        {e.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                                                    </button>
                                                    <button type="button" onClick={() => handleDeleteEmployee(e)} disabled={pending} title="Eliminar" className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-x-auto border border-gray-200 dark:border-zinc-800">
                    {kiosks.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 dark:text-zinc-400">
                            Aún no hay kioscos. Creá uno y abrí su enlace en la pantalla del taller.
                        </div>
                    ) : (
                        <table className="w-full text-sm min-w-[720px]">
                            <thead className="bg-gray-50 dark:bg-zinc-900/60">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Kiosco</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Enlace</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Estado</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {kiosks.map((k) => (
                                    <tr key={k.id} className={k.isActive ? '' : 'opacity-60'}>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                                                <Monitor size={14} className="text-orange-600 dark:text-orange-400" />
                                                {k.label}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden text-xs font-mono">
                                                <code className="px-2 py-1.5 text-gray-700 dark:text-zinc-300 truncate max-w-[160px]">
                                                    /rrhh/kiosko/{k.accessToken.slice(0, 8)}…
                                                </code>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyKiosk(k)}
                                                    title="Copiar enlace completo"
                                                    className={`px-2 py-1.5 border-l border-gray-200 dark:border-zinc-700 ${
                                                        copiedId === k.id ? 'text-green-600 dark:text-green-400' : 'text-gray-500 hover:text-orange-600 dark:hover:text-orange-400'
                                                    }`}
                                                >
                                                    {copiedId === k.id ? <Check size={12} /> : <Copy size={12} />}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-bold ${k.isActive ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-zinc-500'}`}>
                                                {k.isActive ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="inline-flex items-center gap-1">
                                                <a
                                                    href={kioskUrl(k.accessToken)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title="Abrir pantalla del kiosco"
                                                    className="p-1.5 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg"
                                                >
                                                    <ExternalLink size={14} />
                                                </a>
                                                <button type="button" onClick={() => handleRotateKiosk(k)} disabled={pending} title="Generar enlace nuevo" className="p-1.5 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg">
                                                    <RefreshCcw size={14} />
                                                </button>
                                                <button type="button" onClick={() => runAction(() => setKioskActiveAction(k.id, !k.isActive))} disabled={pending} title={k.isActive ? 'Desactivar' : 'Activar'} className="p-1.5 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg">
                                                    {k.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                                                </button>
                                                <button type="button" onClick={() => handleDeleteKiosk(k)} disabled={pending} title="Eliminar" className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {creating && (
                <EmployeeModal
                    title="Nuevo empleado"
                    submitLabel="Crear y enviar invitación"
                    onClose={() => setCreating(false)}
                    onSubmit={async (values) => {
                        const res = await createEmployeeAction(values);
                        if (res?.error) return res.error;
                        if (res?.warning) setNotice(res.warning);
                        setCreating(false);
                        router.refresh();
                        return null;
                    }}
                />
            )}

            {editing && (
                <EmployeeModal
                    title="Editar empleado"
                    submitLabel="Guardar cambios"
                    initial={editing}
                    emailReadOnly
                    onClose={() => setEditing(null)}
                    onSubmit={async (values) => {
                        const res = await updateEmployeeAction(editing.id, {
                            fullName: values.fullName,
                            position: values.position,
                            phone: values.phone
                        });
                        if (res?.error) return res.error;
                        setEditing(null);
                        router.refresh();
                        return null;
                    }}
                />
            )}

            {scheduling && (
                <ScheduleModal
                    employee={scheduling}
                    schedule={schedules[scheduling.id] || null}
                    onClose={() => setScheduling(null)}
                    onSubmit={async (input) => {
                        const res = await saveEmployeeScheduleAction(scheduling.id, input);
                        if (res?.error) return res.error;
                        setScheduling(null);
                        router.refresh();
                        return null;
                    }}
                />
            )}

            {creatingKiosk && (
                <KioskModal
                    createdUrl={createdKioskUrl}
                    onClose={() => {
                        setCreatingKiosk(false);
                        setCreatedKioskUrl(null);
                        if (createdKioskUrl) router.refresh();
                    }}
                    onSubmit={async (label) => {
                        const res = await createKioskAction(label);
                        if (res?.error) return res.error;
                        setCreatedKioskUrl(kioskUrl(res.accessToken || ''));
                        return null;
                    }}
                />
            )}
        </div>
    );
}

function EmployeeModal({
    title,
    submitLabel,
    initial,
    emailReadOnly = false,
    onClose,
    onSubmit
}: {
    title: string;
    submitLabel: string;
    initial?: Employee;
    emailReadOnly?: boolean;
    onClose: () => void;
    onSubmit: (values: CreateEmployeeInput) => Promise<string | null>;
}) {
    const dialogRef = useDialog();
    const [fullName, setFullName] = useState(initial?.fullName || '');
    const [email, setEmail] = useState(initial?.email || '');
    const [position, setPosition] = useState(initial?.position || '');
    const [phone, setPhone] = useState(initial?.phone || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        setSaving(true);
        setError(null);
        const msg = await onSubmit({ fullName, email, position, phone });
        setSaving(false);
        if (msg) setError(msg);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl p-6 outline-none">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
                    <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={submit} className="space-y-3">
                    <Field label="Nombre completo">
                        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ej. María Rodríguez" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent" required />
                    </Field>
                    <Field label="Email">
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="empleado@ejemplo.com" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent disabled:opacity-60" required autoComplete="off" disabled={emailReadOnly} />
                        {emailReadOnly && <span className="block mt-1 text-[11px] text-gray-500 dark:text-zinc-500">El correo no se puede cambiar desde acá.</span>}
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Puesto">
                            <input type="text" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="ej. Costurera" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent" />
                        </Field>
                        <Field label="Teléfono">
                            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="8888-8888" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent" />
                        </Field>
                    </div>
                    {error && <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">{error}</div>}
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">Cancelar</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2">
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            {submitLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function KioskModal({
    createdUrl,
    onClose,
    onSubmit
}: {
    createdUrl: string | null;
    onClose: () => void;
    onSubmit: (label: string) => Promise<string | null>;
}) {
    const dialogRef = useDialog();
    const [label, setLabel] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const submit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        setSaving(true);
        setError(null);
        const msg = await onSubmit(label);
        setSaving(false);
        if (msg) setError(msg);
    };

    const copy = async () => {
        if (!createdUrl) return;
        try {
            await navigator.clipboard.writeText(createdUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            prompt('Copiá el enlace:', createdUrl);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={createdUrl ? 'Kiosco creado' : 'Nuevo kiosco'} tabIndex={-1} className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl p-6 outline-none">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{createdUrl ? 'Kiosco creado' : 'Nuevo kiosco'}</h3>
                    <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                        <X size={18} />
                    </button>
                </div>

                {createdUrl ? (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-zinc-400">
                            Abrí este enlace en la pantalla del taller. Mostrará el
                            código QR que los empleados escanean. Es un enlace
                            secreto — no lo compartas fuera del taller.
                        </p>
                        <div className="rounded-xl border border-orange-200 dark:border-orange-900/40 bg-orange-50/60 dark:bg-orange-950/20 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-orange-700 dark:text-orange-400 mb-1">Enlace del kiosco</div>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-xs font-mono text-gray-700 dark:text-zinc-300 break-all">{createdUrl}</code>
                                <button type="button" onClick={copy} className={`p-2 rounded-lg shrink-0 ${copied ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300' : 'bg-orange-600 text-white hover:bg-orange-700'}`} title={copied ? 'Copiado' : 'Copiar'}>
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 text-sm">Listo</button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-3">
                        <Field label="Nombre del kiosco">
                            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ej. Entrada principal" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent" required />
                        </Field>
                        <p className="text-[11px] text-gray-500 dark:text-zinc-500 italic">
                            Se genera un enlace secreto para abrir en la pantalla del
                            taller. El QR rota solo cada 10 minutos.
                        </p>
                        {error && <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">{error}</div>}
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">Cancelar</button>
                            <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2">
                                {saving && <Loader2 size={14} className="animate-spin" />}
                                Crear kiosco
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// Monday-first weekday order for the toggles (0=Sun … 6=Sat).
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function ScheduleModal({
    employee,
    schedule,
    onClose,
    onSubmit
}: {
    employee: Employee;
    schedule: Schedule | null;
    onClose: () => void;
    onSubmit: (input: ScheduleInput) => Promise<string | null>;
}) {
    const dialogRef = useDialog();
    const base = schedule || DEFAULT_SCHEDULE;
    const [workdays, setWorkdays] = useState<number[]>(base.workdays);
    const [startTime, setStartTime] = useState(base.startTime);
    const [endTime, setEndTime] = useState(base.endTime);
    const [lunchMin, setLunchMin] = useState(String(base.lunchMin));
    const [breakMin, setBreakMin] = useState(String(base.breakMin));
    const [graceMin, setGraceMin] = useState(String(base.graceMin));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleDay = (d: number) =>
        setWorkdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

    const submit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        setSaving(true);
        setError(null);
        const msg = await onSubmit({
            workdays: [...workdays].sort((a, b) => a - b),
            startTime,
            endTime,
            lunchMin: Number(lunchMin) || 0,
            breakMin: Number(breakMin) || 0,
            graceMin: Number(graceMin) || 0
        });
        setSaving(false);
        if (msg) setError(msg);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Horario" tabIndex={-1} className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl p-6 outline-none">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Horario</h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-400">{employee.fullName}</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">Días laborales</span>
                        <div className="flex flex-wrap gap-1.5">
                            {WEEKDAY_ORDER.map((d) => {
                                const on = workdays.includes(d);
                                return (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => toggleDay(d)}
                                        aria-pressed={on}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${
                                            on
                                                ? 'bg-orange-600 text-white border-orange-600'
                                                : 'bg-transparent text-gray-600 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:border-orange-400'
                                        }`}
                                    >
                                        {WEEKDAY_LABELS[d]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Entrada">
                            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent" required />
                        </Field>
                        <Field label="Salida">
                            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent" required />
                        </Field>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <Field label="Almuerzo (min)">
                            <input type="number" min={0} value={lunchMin} onChange={(e) => setLunchMin(e.target.value)} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent" />
                        </Field>
                        <Field label="Break (min)">
                            <input type="number" min={0} value={breakMin} onChange={(e) => setBreakMin(e.target.value)} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent" />
                        </Field>
                        <Field label="Tolerancia (min)">
                            <input type="number" min={0} value={graceMin} onChange={(e) => setGraceMin(e.target.value)} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent" />
                        </Field>
                    </div>

                    <p className="text-[11px] text-gray-500 dark:text-zinc-500">
                        La tolerancia son los minutos de gracia antes de marcar
                        “llegada tarde”. Almuerzo y break son el máximo permitido.
                    </p>

                    {error && <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">{error}</div>}

                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">Cancelar</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2">
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            Guardar horario
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1">{label}</span>
            {children}
        </label>
    );
}
