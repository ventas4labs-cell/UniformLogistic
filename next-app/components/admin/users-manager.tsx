'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Users, AlertCircle, Plus, X, KeyRound, Edit2 } from 'lucide-react';
import type { Company } from '@/lib/services/companies';
import type { DirectoryUser } from '@/lib/services/companyUsers';
import {
    assignUserAction,
    createUserAction,
    updateUserAction,
    setUserPasswordAction
} from '@/app/(admin)/admin/users/actions';

interface Props {
    initialUsers: DirectoryUser[];
    companies: Company[];
}

export function UsersManager({ initialUsers, companies }: Props) {
    const router = useRouter();
    const [users] = useState<DirectoryUser[]>(initialUsers);
    const [savingUserId, setSavingUserId] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ email: '', password: '', fullName: '' });
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const [editTarget, setEditTarget] = useState<DirectoryUser | null>(null);
    const [editForm, setEditForm] = useState({ email: '', fullName: '', phone: '' });
    const [editing, setEditing] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    const [resetTarget, setResetTarget] = useState<DirectoryUser | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [resetting, setResetting] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);

    const handleAssign = (userId: string, companyId: string) => {
        setSavingUserId(userId);
        startTransition(async () => {
            try {
                await assignUserAction(userId, companyId);
                router.refresh();
            } catch (e) {
                alert(`No se pudo asignar: ${e instanceof Error ? e.message : e}`);
            } finally {
                setSavingUserId(null);
            }
        });
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setCreateError(null);
        try {
            await createUserAction(createForm.email, createForm.password, createForm.fullName);
            setShowCreate(false);
            setCreateForm({ email: '', password: '', fullName: '' });
            router.refresh();
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Error al crear usuario');
        } finally {
            setCreating(false);
        }
    };

    const startEdit = (u: DirectoryUser) => {
        setEditTarget(u);
        setEditForm({ email: u.email, fullName: u.fullName, phone: u.phone });
        setEditError(null);
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget) return;
        setEditing(true);
        setEditError(null);
        try {
            await updateUserAction(
                editTarget.userId,
                editForm.email,
                editForm.fullName,
                editForm.phone
            );
            setEditTarget(null);
            router.refresh();
        } catch (err) {
            setEditError(err instanceof Error ? err.message : 'Error al actualizar usuario');
        } finally {
            setEditing(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetTarget) return;
        setResetting(true);
        setResetError(null);
        try {
            await setUserPasswordAction(resetTarget.userId, newPassword);
            setResetTarget(null);
            setNewPassword('');
        } catch (err) {
            setResetError(err instanceof Error ? err.message : 'Error al cambiar contraseña');
        } finally {
            setResetting(false);
        }
    };

    const orphanCount = users.filter((u) => !u.companyId).length;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Usuarios</h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Crea usuarios, asigna empresas y gestiona contraseñas.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setShowCreate(true);
                        setCreateError(null);
                    }}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md flex items-center gap-2"
                >
                    <Plus size={18} /> Nuevo Usuario
                </button>
            </div>

            {orphanCount > 0 && (
                <div className="mb-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 p-3 rounded-lg flex items-center gap-2 text-sm">
                    <AlertCircle size={18} />
                    Hay <strong>{orphanCount}</strong> usuario{orphanCount === 1 ? '' : 's'} sin empresa asignada. No pueden hacer pedidos hasta que los actives.
                </div>
            )}

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-200 dark:border-zinc-800">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Usuario</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Email</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Teléfono</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Registrado</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Empresa asignada</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500 dark:text-zinc-400">
                                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                                    Sin usuarios registrados.
                                </td>
                            </tr>
                        ) : (
                            users.map((u) => (
                                <tr
                                    key={u.userId}
                                    className={`hover:bg-gray-50 dark:hover:bg-zinc-800 ${!u.companyId ? 'bg-amber-50/40 dark:bg-amber-950/30' : ''}`}
                                >
                                    <td className="p-4 font-bold text-gray-900 dark:text-zinc-100">{u.fullName || '—'}</td>
                                    <td className="p-4 text-gray-600 dark:text-zinc-400 text-sm">{u.email}</td>
                                    <td className="p-4 text-gray-600 dark:text-zinc-400 text-sm">{u.phone || '—'}</td>
                                    <td className="p-4 text-gray-500 dark:text-zinc-400 text-xs">
                                        {new Date(u.signedUpAt).toLocaleDateString()}
                                    </td>
                                    <td className="p-4">
                                        <select
                                            value={u.companyId || ''}
                                            disabled={savingUserId === u.userId}
                                            onChange={(e) => handleAssign(u.userId, e.target.value)}
                                            className="p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50 min-w-[200px]"
                                        >
                                            <option value="">— Sin asignar —</option>
                                            {companies.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </select>
                                        {savingUserId === u.userId && (
                                            <Loader2 className="animate-spin inline ml-2 text-gray-400 dark:text-zinc-500" size={14} />
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            <button
                                                onClick={() => startEdit(u)}
                                                className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-orange-50 hover:text-orange-600 rounded-lg"
                                                title="Editar usuario"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setResetTarget(u);
                                                    setNewPassword('');
                                                    setResetError(null);
                                                }}
                                                className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-orange-50 hover:text-orange-600 rounded-lg"
                                                title="Cambiar contraseña"
                                            >
                                                <KeyRound size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showCreate && (
                <Modal title="Nuevo Usuario" onClose={() => setShowCreate(false)}>
                    <form onSubmit={handleCreate} className="p-6 space-y-4">
                        <Field label="Nombre completo">
                            <input
                                type="text"
                                value={createForm.fullName}
                                onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="Juan Pérez"
                            />
                        </Field>
                        <Field label="Email *">
                            <input
                                required
                                type="email"
                                value={createForm.email}
                                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="usuario@empresa.com"
                            />
                        </Field>
                        <Field label="Contraseña *">
                            <input
                                required
                                type="text"
                                minLength={6}
                                value={createForm.password}
                                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-mono"
                                placeholder="mínimo 6 caracteres"
                            />
                        </Field>
                        {createError && (
                            <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/50">
                                {createError}
                            </div>
                        )}
                        <ModalActions
                            onCancel={() => setShowCreate(false)}
                            loading={creating}
                            submitLabel="Crear usuario"
                        />
                    </form>
                </Modal>
            )}

            {resetTarget && (
                <Modal title="Cambiar Contraseña" onClose={() => setResetTarget(null)}>
                    <form onSubmit={handleResetPassword} className="p-6 space-y-4">
                        <div className="bg-gray-50 dark:bg-zinc-900/60 p-3 rounded-lg text-sm">
                            <p className="text-gray-500 dark:text-zinc-400">Usuario</p>
                            <p className="font-bold text-gray-900 dark:text-zinc-100">{resetTarget.email}</p>
                            {resetTarget.fullName && (
                                <p className="text-gray-600 dark:text-zinc-400">{resetTarget.fullName}</p>
                            )}
                        </div>
                        <Field label="Nueva contraseña *">
                            <input
                                required
                                type="text"
                                minLength={6}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-mono"
                                placeholder="mínimo 6 caracteres"
                            />
                        </Field>
                        {resetError && (
                            <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/50">
                                {resetError}
                            </div>
                        )}
                        <ModalActions
                            onCancel={() => setResetTarget(null)}
                            loading={resetting}
                            submitLabel="Guardar contraseña"
                        />
                    </form>
                </Modal>
            )}

            {editTarget && (
                <Modal title="Editar Usuario" onClose={() => setEditTarget(null)}>
                    <form onSubmit={handleEdit} className="p-6 space-y-4">
                        <Field label="Nombre completo">
                            <input
                                type="text"
                                value={editForm.fullName}
                                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </Field>
                        <Field label="Email *">
                            <input
                                required
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </Field>
                        <Field label="Teléfono">
                            <input
                                type="tel"
                                value={editForm.phone}
                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </Field>
                        {editError && (
                            <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/50">
                                {editError}
                            </div>
                        )}
                        <ModalActions
                            onCancel={() => setEditTarget(null)}
                            loading={editing}
                            submitLabel="Guardar cambios"
                        />
                    </form>
                </Modal>
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

function Modal({
    title,
    onClose,
    children
}: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
                    <h3 className="text-xl font-bold">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg">
                        <X size={20} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function ModalActions({
    onCancel,
    loading,
    submitLabel
}: {
    onCancel: () => void;
    loading: boolean;
    submitLabel: string;
}) {
    return (
        <div className="flex gap-3 pt-2">
            <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
                Cancelar
            </button>
            <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" size={18} /> : null}
                {submitLabel}
            </button>
        </div>
    );
}
