'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Plus, Edit2, Trash2, Loader2, X, Link2, Check, Copy, RefreshCcw, Users } from 'lucide-react';
import { Company, CompanyInput } from '@/lib/services/companies';
import {
    createCompanyAction,
    updateCompanyAction,
    deleteCompanyAction,
    generateCompanyOrderLinkAction,
    regenerateCompanyOrderLinkAction
} from '@/app/(admin)/admin/companies/actions';

const emptyForm: CompanyInput = {
    name: '',
    documentNumber: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    isActive: true
};

export function CompaniesManager({
    initialCompanies,
    embedded = false,
    autoOpenCreate = false,
    onClose
}: {
    initialCompanies: Company[];
    // Embedded mode renders ONLY the create/edit modal (no list/header)
    // so it can be summoned as a popup from the fast actions.
    embedded?: boolean;
    autoOpenCreate?: boolean;
    onClose?: () => void;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [editing, setEditing] = useState<Company | null>(null);
    const [showForm, setShowForm] = useState(autoOpenCreate);
    const [form, setForm] = useState<CompanyInput>(emptyForm);

    const closeForm = () => {
        setShowForm(false);
        onClose?.();
    };
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    // Per-row order-link work in flight (generate / regenerate).
    const [linkBusyId, setLinkBusyId] = useState<string | null>(null);

    const orderLinkUrl = (token: string) =>
        `${window.location.origin}/o/${token}`;

    const copyOrderLink = async (company: Company) => {
        if (!company.accessToken) return;
        await navigator.clipboard.writeText(orderLinkUrl(company.accessToken));
        setCopiedId(company.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const generateLink = (company: Company) => {
        setLinkBusyId(company.id);
        startTransition(async () => {
            try {
                const res = await generateCompanyOrderLinkAction(company.id);
                if (res.error) alert(res.error);
                else if (res.accessToken) {
                    await navigator.clipboard
                        .writeText(orderLinkUrl(res.accessToken))
                        .catch(() => {});
                    setCopiedId(company.id);
                    setTimeout(() => setCopiedId(null), 2000);
                }
                router.refresh();
            } finally {
                setLinkBusyId(null);
            }
        });
    };

    const regenerateLink = (company: Company) => {
        if (
            !confirm(
                `¿Generar un link nuevo para "${company.name}"? El link anterior dejará de funcionar de inmediato.`
            )
        )
            return;
        setLinkBusyId(company.id);
        startTransition(async () => {
            try {
                const res = await regenerateCompanyOrderLinkAction(company.id);
                if (res.error) alert(res.error);
                else if (res.accessToken) {
                    await navigator.clipboard
                        .writeText(orderLinkUrl(res.accessToken))
                        .catch(() => {});
                    setCopiedId(company.id);
                    setTimeout(() => setCopiedId(null), 2000);
                }
                router.refresh();
            } finally {
                setLinkBusyId(null);
            }
        });
    };

    const startCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setShowForm(true);
        setError(null);
    };

    const startEdit = (company: Company) => {
        setEditing(company);
        setForm({
            name: company.name,
            documentNumber: company.documentNumber,
            contactName: company.contactName,
            email: company.email,
            phone: company.phone,
            address: company.address,
            isActive: company.isActive
        });
        setShowForm(true);
        setError(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            if (editing) {
                await updateCompanyAction(editing.id, form);
                setShowForm(false);
                router.refresh();
                onClose?.();
            } else {
                const res = await createCompanyAction(form);
                if (res.error) {
                    setError(res.error);
                    return;
                }
                setShowForm(false);
                router.refresh();
                onClose?.();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (company: Company) => {
        if (!confirm(`¿Eliminar la empresa "${company.name}"? Esta acción no se puede deshacer.`)) return;
        startTransition(async () => {
            try {
                await deleteCompanyAction(company.id);
                router.refresh();
            } catch (err) {
                alert(`No se pudo eliminar: ${err instanceof Error ? err.message : err}`);
            }
        });
    };

    return (
        <div>
            {!embedded && (
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Empresas</h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">Administra los clientes corporativos del sistema.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={startCreate}
                        className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md flex items-center gap-2"
                    >
                        <Plus size={18} /> Nueva Empresa
                    </button>
                    {/* Usuarios shortcut — the module used to be its own
                        sidebar entry but lives more naturally next to the
                        empresas they're associated with. */}
                    <Link
                        href="/admin/users"
                        title="Usuarios"
                        aria-label="Usuarios"
                        className="p-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:text-orange-700 dark:hover:text-orange-300 hover:border-orange-300 transition-colors"
                    >
                        <Users size={18} />
                    </Link>
                </div>
            </div>
            )}

            {!embedded && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full text-left min-w-[760px]">
                    <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-200 dark:border-zinc-800">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Nombre</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Cédula Jurídica</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Contacto</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Link de pedidos</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Estado</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {initialCompanies.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500 dark:text-zinc-400">
                                    <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                                    Aún no hay empresas registradas.
                                </td>
                            </tr>
                        ) : (
                            initialCompanies.map((c) => (
                                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                    <td className="p-4">
                                        <Link
                                            href={`/admin/companies/${c.id}`}
                                            className="font-bold text-gray-900 dark:text-zinc-100 hover:text-orange-600 dark:hover:text-orange-400 hover:underline"
                                        >
                                            {c.name}
                                        </Link>
                                    </td>
                                    <td className="p-4 font-mono text-sm text-gray-600 dark:text-zinc-400">{c.documentNumber}</td>
                                    <td className="p-4 text-gray-600 dark:text-zinc-400">{c.contactName || '—'}</td>
                                    <td className="p-4">
                                        {c.accessToken ? (
                                            <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
                                                <code
                                                    className="px-2 py-1.5 text-xs font-mono text-gray-700 dark:text-zinc-300 truncate max-w-[150px]"
                                                    title={`/o/${c.accessToken}`}
                                                >
                                                    /o/{c.accessToken.slice(0, 10)}…
                                                </code>
                                                <button
                                                    onClick={() => copyOrderLink(c)}
                                                    title="Copiar link"
                                                    className={`px-2 py-1.5 border-l border-gray-200 dark:border-zinc-700 transition-colors ${
                                                        copiedId === c.id
                                                            ? 'text-green-600 dark:text-green-400'
                                                            : 'text-gray-500 hover:text-orange-600 dark:hover:text-orange-400'
                                                    }`}
                                                >
                                                    {copiedId === c.id ? <Check size={13} /> : <Copy size={13} />}
                                                </button>
                                                <button
                                                    onClick={() => regenerateLink(c)}
                                                    disabled={linkBusyId === c.id}
                                                    title="Generar link nuevo (invalida el anterior)"
                                                    className="px-2 py-1.5 border-l border-gray-200 dark:border-zinc-700 text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 disabled:opacity-50"
                                                >
                                                    {linkBusyId === c.id ? (
                                                        <Loader2 size={13} className="animate-spin" />
                                                    ) : (
                                                        <RefreshCcw size={13} />
                                                    )}
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => generateLink(c)}
                                                disabled={linkBusyId === c.id}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/50 disabled:opacity-50"
                                            >
                                                {linkBusyId === c.id ? (
                                                    <Loader2 size={13} className="animate-spin" />
                                                ) : (
                                                    <Link2 size={13} />
                                                )}
                                                Generar link
                                            </button>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <span
                                            className={`text-xs font-bold px-2 py-1 rounded-full ${c.isActive ? 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'}`}
                                        >
                                            {c.isActive ? 'Activa' : 'Inactiva'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => startEdit(c)}
                                                className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-orange-50 hover:text-orange-600 rounded-lg"
                                                title="Editar"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(c)}
                                                disabled={pending}
                                                className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-red-50 hover:text-red-600 rounded-lg disabled:opacity-50"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            )}

            {showForm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
                            <h3 className="text-xl font-bold">{editing ? 'Editar Empresa' : 'Nueva Empresa'}</h3>
                            <button onClick={closeForm} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <Field label="Nombre de la empresa *">
                                <input
                                    required
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </Field>
                            <Field label="Cédula Jurídica *">
                                <input
                                    required
                                    type="text"
                                    value={form.documentNumber}
                                    onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </Field>
                            <Field label="Persona de contacto">
                                <input
                                    type="text"
                                    value={form.contactName || ''}
                                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Email">
                                    <input
                                        type="email"
                                        value={form.email || ''}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </Field>
                                <Field label="Teléfono">
                                    <input
                                        type="tel"
                                        value={form.phone || ''}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </Field>
                            </div>
                            <Field label="Dirección">
                                <textarea
                                    value={form.address || ''}
                                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                                    rows={2}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </Field>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-zinc-300">
                                <input
                                    type="checkbox"
                                    checked={form.isActive ?? true}
                                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                    className="w-4 h-4 text-orange-600 dark:text-orange-400 rounded"
                                />
                                Empresa activa
                            </label>

                            {/* Order link — auto-generated on create. The
                                empresa places orders through an individual
                                /o/<token> link; no username/password. */}
                            {!editing && (
                                <div className="rounded-xl border border-orange-200 dark:border-orange-900/40 bg-orange-50/40 dark:bg-orange-950/20 p-4 flex items-start gap-3">
                                    <Link2
                                        size={18}
                                        className="text-orange-600 dark:text-orange-400 shrink-0 mt-0.5"
                                    />
                                    <p className="text-xs text-gray-600 dark:text-zinc-300">
                                        Al crear la empresa se genera un{' '}
                                        <span className="font-semibold">link individual de pedidos</span>.
                                        Copialo desde la lista y compartilo con la empresa — con
                                        ese link hacen pedidos sin usuario ni contraseña.
                                    </p>
                                </div>
                            )}
                            {error && (
                                <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/50">
                                    {error}
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    className="flex-1 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={18} /> : null}
                                    {editing ? 'Guardar cambios' : 'Crear empresa'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
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
