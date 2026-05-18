'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Edit2, Trash2, Loader2, X, Link2, Check } from 'lucide-react';
import { Company, CompanyInput } from '@/lib/services/companies';
import {
    createCompanyAction,
    updateCompanyAction,
    deleteCompanyAction
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

export function CompaniesManager({ initialCompanies }: { initialCompanies: Company[] }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [editing, setEditing] = useState<Company | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<CompanyInput>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const copyOrderLink = async (company: Company) => {
        const base = window.location.origin + '/catalog';
        const link = `${base}?company=${company.id}`;
        await navigator.clipboard.writeText(link);
        setCopiedId(company.id);
        setTimeout(() => setCopiedId(null), 2000);
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
            } else {
                await createCompanyAction(form);
            }
            setShowForm(false);
            router.refresh();
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
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Empresas</h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">Administra los clientes corporativos del sistema.</p>
                </div>
                <button
                    onClick={startCreate}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md flex items-center gap-2"
                >
                    <Plus size={18} /> Nueva Empresa
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-200 dark:border-zinc-800">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Nombre</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Cédula Jurídica</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Contacto</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Teléfono</th>
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
                                    <td className="p-4 font-bold text-gray-900 dark:text-zinc-100">{c.name}</td>
                                    <td className="p-4 font-mono text-sm text-gray-600 dark:text-zinc-400">{c.documentNumber}</td>
                                    <td className="p-4 text-gray-600 dark:text-zinc-400">{c.contactName || '—'}</td>
                                    <td className="p-4 text-gray-600 dark:text-zinc-400">{c.phone || '—'}</td>
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
                                                onClick={() => copyOrderLink(c)}
                                                className={`p-2 rounded-lg transition-colors ${copiedId === c.id ? 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-zinc-400 hover:bg-blue-50 hover:text-blue-600'}`}
                                                title="Copiar link de pedidos"
                                            >
                                                {copiedId === c.id ? <Check size={16} /> : <Link2 size={16} />}
                                            </button>
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

            {showForm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
                            <h3 className="text-xl font-bold">{editing ? 'Editar Empresa' : 'Nueva Empresa'}</h3>
                            <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg">
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
                            {error && (
                                <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/50">
                                    {error}
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
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
