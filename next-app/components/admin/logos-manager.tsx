'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Plus,
    Edit2,
    Trash2,
    Loader2,
    X,
    Sparkles,
    Printer,
    Upload,
    CheckCircle2,
    ImageIcon
} from 'lucide-react';
import type { Logo, LogoCategory, LogoInput } from '@/lib/services/logos';
import { LOGO_CATEGORY_LABELS } from '@/lib/services/logos';
import type { Company } from '@/lib/services/companies';
import {
    createLogoAction,
    updateLogoAction,
    deleteLogoAction,
    uploadLogoImageAction
} from '@/app/(admin)/admin/logos/actions';
import { resizeImageFile } from '@/lib/resize-image';

const emptyForm: LogoInput = {
    name: '',
    imageUrl: '',
    category: 'bordado',
    size: '',
    notes: '',
    isActive: true,
    companyIds: []
};

const categoryIcon = (cat: LogoCategory) =>
    cat === 'bordado' ? <Sparkles size={14} /> : <Printer size={14} />;

const categoryBadgeCls = (cat: LogoCategory) =>
    cat === 'bordado'
        ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300'
        : 'bg-pink-100 dark:bg-pink-950/50 text-pink-800 dark:text-pink-300';

export function LogosManager({
    initialLogos,
    companies
}: {
    initialLogos: Logo[];
    companies: Company[];
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [editing, setEditing] = useState<Logo | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<LogoInput>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);

    const handleImageFile = async (file: File) => {
        setUploadingImage(true);
        setError(null);
        try {
            const { file: optimized } = await resizeImageFile(file);
            const fd = new FormData();
            fd.append('file', optimized);
            const url = await uploadLogoImageAction(fd);
            setForm((f) => ({ ...f, imageUrl: url }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al subir la imagen');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleImageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleImageFile(file);
        e.target.value = '';
    };

    const handleImageDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleImageFile(file);
    };

    const startCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setShowForm(true);
        setError(null);
    };

    const startEdit = (l: Logo) => {
        setEditing(l);
        setForm({
            name: l.name,
            imageUrl: l.imageUrl,
            category: l.category,
            size: l.size,
            notes: l.notes,
            isActive: l.isActive,
            companyIds: l.companyIds || []
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
                await updateLogoAction(editing.id, form);
            } else {
                await createLogoAction(form);
            }
            setShowForm(false);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (l: Logo) => {
        if (!confirm(`¿Eliminar el logo "${l.name}"?`)) return;
        startTransition(async () => {
            try {
                await deleteLogoAction(l.id);
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
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Logos</h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Catálogo de logos. Cada uno se aplica con bordado o impresión, y se
                        agrega a los productos como un insumo más.
                    </p>
                </div>
                <button
                    onClick={startCreate}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md flex items-center gap-2"
                >
                    <Plus size={18} /> Nuevo Logo
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-200 dark:border-zinc-800">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400 w-16"></th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Nombre</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Categoría</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Tamaño</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Empresas</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Estado</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {initialLogos.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-gray-500 dark:text-zinc-400">
                                    <Sparkles size={32} className="mx-auto mb-2 opacity-30" />
                                    Sin logos registrados.
                                </td>
                            </tr>
                        ) : (
                            initialLogos.map((l) => (
                                <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                    <td className="p-4">
                                        {l.imageUrl ? (
                                            <button
                                                onClick={() =>
                                                    setPreviewImage({ src: l.imageUrl, alt: l.name })
                                                }
                                                className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 hover:ring-2 hover:ring-orange-400 transition-all cursor-pointer bg-white"
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={l.imageUrl}
                                                    alt={l.name}
                                                    className="w-full h-full object-contain"
                                                />
                                            </button>
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                                                <ImageIcon size={16} className="text-gray-300 dark:text-zinc-600" />
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 font-bold text-gray-900 dark:text-zinc-100">
                                        {l.name}
                                    </td>
                                    <td className="p-4">
                                        <span
                                            className={`text-xs font-bold px-2 py-1 rounded-full inline-flex items-center gap-1 ${categoryBadgeCls(
                                                l.category
                                            )}`}
                                        >
                                            {categoryIcon(l.category)}
                                            {LOGO_CATEGORY_LABELS[l.category]}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-600 dark:text-zinc-400 text-sm font-mono">
                                        {l.size || '—'}
                                    </td>
                                    <td className="p-4 text-gray-600 dark:text-zinc-400 text-sm">
                                        {l.companyIds.length === 0 ? (
                                            <span className="text-amber-700 dark:text-amber-300 text-xs font-semibold">
                                                Sin asignar
                                            </span>
                                        ) : (
                                            `${l.companyIds.length} empresa${l.companyIds.length === 1 ? '' : 's'}`
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <span
                                            className={`text-xs font-bold px-2 py-1 rounded-full ${
                                                l.isActive
                                                    ? 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300'
                                                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                                            }`}
                                        >
                                            {l.isActive ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => startEdit(l)}
                                                className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-orange-50 hover:text-orange-600 rounded-lg"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(l)}
                                                disabled={pending}
                                                className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-red-50 hover:text-red-600 rounded-lg disabled:opacity-50"
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

            {previewImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden max-w-lg w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute top-3 right-3 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
                        >
                            <X size={18} />
                        </button>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={previewImage.src}
                            alt={previewImage.alt}
                            className="w-full h-auto max-h-[70vh] object-contain bg-white"
                        />
                        <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800">
                            <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">
                                {previewImage.alt}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
                            <h3 className="text-xl font-bold">
                                {editing ? 'Editar Logo' : 'Nuevo Logo'}
                            </h3>
                            <button
                                onClick={() => setShowForm(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                                aria-label="Cerrar"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Nombre *">
                                    <input
                                        required
                                        type="text"
                                        value={form.name}
                                        onChange={(e) =>
                                            setForm({ ...form, name: e.target.value })
                                        }
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </Field>
                                <Field label="Categoría *">
                                    <select
                                        value={form.category}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                category: e.target.value as LogoCategory
                                            })
                                        }
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    >
                                        <option value="bordado">Bordado</option>
                                        <option value="impresion">Impresión</option>
                                    </select>
                                </Field>
                            </div>

                            <Field label="Tamaño">
                                <input
                                    type="text"
                                    value={form.size || ''}
                                    onChange={(e) =>
                                        setForm({ ...form, size: e.target.value })
                                    }
                                    placeholder='ej. 10 × 6 cm, 3" diámetro'
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                    Tamaño físico del logo aplicado. Texto libre porque
                                    los talleres usan distintas unidades y convenciones.
                                </p>
                            </Field>

                            <Field label="Imagen del logo">
                                <label
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragging(true);
                                    }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={handleImageDrop}
                                    className={`flex items-center gap-3 border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                                        dragging
                                            ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                                            : form.imageUrl
                                              ? 'border-green-300 bg-green-50/40 dark:bg-green-950/30 hover:border-orange-400'
                                              : 'border-gray-300 dark:border-zinc-700 hover:border-orange-400 hover:bg-orange-50/50'
                                    }`}
                                >
                                    {uploadingImage ? (
                                        <Loader2
                                            className="animate-spin text-gray-400 dark:text-zinc-500 shrink-0"
                                            size={20}
                                        />
                                    ) : form.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={form.imageUrl}
                                            alt="Vista previa"
                                            className="w-14 h-14 object-contain rounded-md border border-gray-200 dark:border-zinc-800 shrink-0 bg-white"
                                        />
                                    ) : (
                                        <Upload
                                            className="text-gray-400 dark:text-zinc-500 shrink-0"
                                            size={20}
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                                            {form.imageUrl ? (
                                                <>
                                                    <CheckCircle2
                                                        className="text-green-600 dark:text-green-400"
                                                        size={14}
                                                    />
                                                    Imagen cargada
                                                </>
                                            ) : (
                                                <>Arrastra una imagen o haz clic para seleccionar</>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                                            {form.imageUrl ? (
                                                <span className="font-mono truncate block">
                                                    {form.imageUrl.split('/').pop()}
                                                </span>
                                            ) : (
                                                'PNG, JPG, WEBP, GIF o SVG · máx. 5 MB'
                                            )}
                                        </div>
                                    </div>
                                    {form.imageUrl && !uploadingImage && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setForm({ ...form, imageUrl: '' });
                                            }}
                                            className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-md shrink-0"
                                            aria-label="Quitar imagen"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageInput}
                                        disabled={uploadingImage}
                                        className="hidden"
                                    />
                                </label>
                            </Field>

                            <Field label="Notas">
                                <textarea
                                    value={form.notes || ''}
                                    onChange={(e) =>
                                        setForm({ ...form, notes: e.target.value })
                                    }
                                    rows={2}
                                    placeholder="Detalles de la aplicación, dimensiones, colores…"
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </Field>

                            <Field label="Empresas asignadas">
                                {companies.length === 0 ? (
                                    <p className="text-xs text-gray-500 dark:text-zinc-400 italic">
                                        No hay empresas. Crea una en la pestaña &ldquo;Empresas&rdquo;.
                                    </p>
                                ) : (
                                    <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-3 max-h-44 overflow-y-auto space-y-1">
                                        {companies.map((c) => {
                                            const checked = (form.companyIds || []).includes(c.id);
                                            return (
                                                <label
                                                    key={c.id}
                                                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => {
                                                            const set = new Set(form.companyIds || []);
                                                            if (e.target.checked) set.add(c.id);
                                                            else set.delete(c.id);
                                                            setForm({
                                                                ...form,
                                                                companyIds: Array.from(set)
                                                            });
                                                        }}
                                                        className="w-4 h-4 accent-orange-600"
                                                    />
                                                    <span className="font-medium">{c.name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                    Solo las empresas seleccionadas podrán incluir este logo en
                                    sus productos.
                                </p>
                            </Field>

                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-zinc-300">
                                <input
                                    type="checkbox"
                                    checked={form.isActive ?? true}
                                    onChange={(e) =>
                                        setForm({ ...form, isActive: e.target.checked })
                                    }
                                    className="w-4 h-4 text-orange-600 dark:text-orange-400 rounded"
                                />
                                Logo activo
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
                                    {editing ? 'Guardar cambios' : 'Crear logo'}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                {label}
            </label>
            {children}
        </div>
    );
}
