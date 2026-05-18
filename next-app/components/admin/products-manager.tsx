'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Trash2, Loader2, X, Package, Upload, CheckCircle2 } from 'lucide-react';
import type { AdminProduct, ProductInput, BomItem } from '@/lib/services/products';
import {
    createProductAction,
    updateProductAction,
    deleteProductAction,
    uploadProductImageAction
} from '@/app/(admin)/admin/products/actions';
import { validateCABYS } from '@/lib/facturacion/validation/cabys-validator';
import { VoiceProductDictate } from '@/components/admin/voice-product-dictate';

const emptyForm: ProductInput = {
    productCode: '',
    name: '',
    description: '',
    imageUrl: '',
    productType: 'shirt',
    gender: 'unisex',
    sizes: { men: [], women: [], waist: [], inseam: [] },
    fabricType: '',
    isActive: true,
    bom: [],
    codigoCabys: ''
};

const parseList = (input: string): string[] =>
    input.split(',').map((s) => s.trim()).filter(Boolean);

const parseNumList = (input: string): number[] =>
    parseList(input).map(Number).filter((n) => !Number.isNaN(n));

export function ProductsManager({ initialProducts }: { initialProducts: AdminProduct[] }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [editing, setEditing] = useState<AdminProduct | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<ProductInput>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [dragging, setDragging] = useState(false);

    const handleImageFile = async (file: File) => {
        setUploadingImage(true);
        setError(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const url = await uploadProductImageAction(fd);
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

    // Called by VoiceProductDictate after the LLM has parsed a dictation.
    // We merge the parsed fields over emptyForm so anything not detected
    // falls back to defaults (and the admin can edit before saving).
    const startCreateWithVoice = (patch: Partial<ProductInput>) => {
        setEditing(null);
        setForm({
            ...emptyForm,
            ...patch,
            // Merge sizes per-bucket so a partial sizes patch doesn't blow
            // away keys the patch didn't touch.
            sizes: { ...emptyForm.sizes, ...(patch.sizes || {}) }
        });
        setShowForm(true);
        setError(null);
    };

    // Same merge logic but on top of the CURRENT form (used by the
    // mic button inside the open modal — typical use case is "edit
    // existing product and dictate a couple of corrections").
    const mergeVoiceIntoForm = (patch: Partial<ProductInput>) => {
        setForm((prev) => ({
            ...prev,
            ...patch,
            sizes: { ...prev.sizes, ...(patch.sizes || {}) }
        }));
        setError(null);
    };

    const startEdit = (p: AdminProduct) => {
        setEditing(p);
        setForm({
            productCode: p.id,
            name: p.name,
            description: p.description,
            imageUrl: p.image,
            productType: p.type,
            gender: p.category === 'Men' ? 'men' : p.category === 'Women' ? 'women' : 'unisex',
            sizes: p.sizes,
            fabricType: p.fabricType,
            isActive: p.isActive,
            bom: p.bom || [],
            codigoCabys: p.codigoCabys || ''
        });
        setShowForm(true);
        setError(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            if (form.codigoCabys && form.codigoCabys.trim()) {
                const result = validateCABYS(form.codigoCabys.trim());
                if (!result.valid) {
                    setError(result.error || 'Código CABYS inválido');
                    setSaving(false);
                    return;
                }
            }
            if (editing) {
                await updateProductAction(editing.uuid, form);
            } else {
                await createProductAction(form);
            }
            setShowForm(false);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (p: AdminProduct) => {
        if (!confirm(`¿Eliminar el producto "${p.name}"?`)) return;
        startTransition(async () => {
            try {
                await deleteProductAction(p.uuid);
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
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Productos</h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Catálogo maestro. Asígnalos a empresas en la pestaña &ldquo;Catálogo&rdquo;.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <VoiceProductDictate onPrefill={startCreateWithVoice} />
                    <button
                        onClick={startCreate}
                        className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md flex items-center gap-2"
                    >
                        <Plus size={18} /> Nuevo Producto
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-200 dark:border-zinc-800">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Código</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Nombre</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Tipo</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Género</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Tela</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">CABYS</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Estado</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {initialProducts.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-gray-500 dark:text-zinc-400">
                                    <Package size={32} className="mx-auto mb-2 opacity-30" />
                                    Sin productos registrados.
                                </td>
                            </tr>
                        ) : (
                            initialProducts.map((p) => (
                                <tr key={p.uuid} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                    <td className="p-4 font-mono text-xs text-gray-500 dark:text-zinc-400">{p.id}</td>
                                    <td className="p-4 font-bold text-gray-900 dark:text-zinc-100">{p.name}</td>
                                    <td className="p-4">
                                        <span
                                            className={`text-xs font-bold px-2 py-1 rounded-full ${p.type === 'shirt' ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300' : 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300'}`}
                                        >
                                            {p.type === 'shirt' ? 'Camisa' : 'Pantalón'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-600 dark:text-zinc-400 text-sm">{p.category}</td>
                                    <td className="p-4 text-gray-600 dark:text-zinc-400 text-sm">{p.fabricType || '—'}</td>
                                    <td className="p-4">
                                        {p.codigoCabys ? (
                                            <span className="text-xs font-mono text-gray-700 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded">
                                                {p.codigoCabys}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded font-semibold">
                                                Sin CABYS
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <span
                                            className={`text-xs font-bold px-2 py-1 rounded-full ${p.isActive ? 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'}`}
                                        >
                                            {p.isActive ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => startEdit(p)}
                                                className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-orange-50 hover:text-orange-600 rounded-lg"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(p)}
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

            {showForm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
                            <h3 className="text-xl font-bold">{editing ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                            <div className="flex items-center gap-2">
                                <VoiceProductDictate
                                    mode={editing ? 'edit' : 'create'}
                                    onPrefill={mergeVoiceIntoForm}
                                />
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                                    aria-label="Cerrar"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Código de producto *">
                                    <input
                                        required
                                        type="text"
                                        value={form.productCode}
                                        onChange={(e) => setForm({ ...form, productCode: e.target.value })}
                                        className="w-full p-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="ej. col-azul-h"
                                    />
                                </Field>
                                <Field label="Nombre *">
                                    <input
                                        required
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </Field>
                            </div>
                            <Field label="Descripción">
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    rows={2}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </Field>
                            <div className="grid grid-cols-3 gap-3">
                                <Field label="Tipo *">
                                    <select
                                        value={form.productType}
                                        onChange={(e) =>
                                            setForm({ ...form, productType: e.target.value as 'shirt' | 'pant' })
                                        }
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    >
                                        <option value="shirt">Camisa</option>
                                        <option value="pant">Pantalón</option>
                                    </select>
                                </Field>
                                <Field label="Género *">
                                    <select
                                        value={form.gender}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                gender: e.target.value as 'men' | 'women' | 'unisex'
                                            })
                                        }
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    >
                                        <option value="men">Hombre</option>
                                        <option value="women">Mujer</option>
                                        <option value="unisex">Unisex</option>
                                    </select>
                                </Field>
                                <Field label="Tela">
                                    <input
                                        type="text"
                                        value={form.fabricType || ''}
                                        onChange={(e) => setForm({ ...form, fabricType: e.target.value })}
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="ej. Columbia"
                                    />
                                </Field>
                            </div>
                            <Field label="Imagen del producto">
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
                                        <Loader2 className="animate-spin text-gray-400 dark:text-zinc-500 shrink-0" size={20} />
                                    ) : form.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={form.imageUrl}
                                            alt="Vista previa"
                                            className="w-14 h-14 object-cover rounded-md border border-gray-200 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-900"
                                        />
                                    ) : (
                                        <Upload className="text-gray-400 dark:text-zinc-500 shrink-0" size={20} />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                                            {form.imageUrl ? (
                                                <>
                                                    <CheckCircle2 className="text-green-600 dark:text-green-400" size={14} />
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

                            <Field label="Código CABYS (Hacienda) — 13 dígitos">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={13}
                                    value={form.codigoCabys || ''}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            codigoCabys: e.target.value.replace(/\D/g, '').slice(0, 13)
                                        })
                                    }
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-mono text-sm"
                                    placeholder="ej. 6201001000000"
                                />
                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                    Se autocompleta en cada línea de factura. Catálogo oficial:{' '}
                                    <a
                                        href="https://www.hacienda.go.cr/contenido/14570-clasificador-de-bienes-y-servicios-cabys"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-orange-600 dark:text-orange-400 hover:underline"
                                    >
                                        BCCR
                                    </a>
                                    .
                                </p>
                            </Field>

                            {form.productType === 'shirt' ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Tallas Hombre (coma)">
                                        <input
                                            type="text"
                                            value={(form.sizes.men || []).join(', ')}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    sizes: { ...form.sizes, men: parseList(e.target.value) }
                                                })
                                            }
                                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                            placeholder="S, M, L, XL, 2XL"
                                        />
                                    </Field>
                                    <Field label="Tallas Mujer (coma)">
                                        <input
                                            type="text"
                                            value={(form.sizes.women || []).join(', ')}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    sizes: { ...form.sizes, women: parseList(e.target.value) }
                                                })
                                            }
                                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                            placeholder="S, M, L, XL"
                                        />
                                    </Field>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Cintura (números, coma)">
                                        <input
                                            type="text"
                                            value={(form.sizes.waist || []).join(', ')}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    sizes: { ...form.sizes, waist: parseNumList(e.target.value) }
                                                })
                                            }
                                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                            placeholder="30, 32, 34, 36"
                                        />
                                    </Field>
                                    <Field label="Largo / Inseam (opcional)">
                                        <input
                                            type="text"
                                            value={(form.sizes.inseam || []).join(', ')}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    sizes: { ...form.sizes, inseam: parseNumList(e.target.value) }
                                                })
                                            }
                                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                            placeholder="30, 32, 34"
                                        />
                                    </Field>
                                </div>
                            )}

                            <div className="border border-gray-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-gray-700 dark:text-zinc-300">Insumos Requeridos (BOM)</label>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setForm({ ...form, bom: [...(form.bom || []), { name: '', qty: 0 }] })
                                        }
                                        className="text-xs bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-lg font-bold hover:bg-orange-100 flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Agregar insumo
                                    </button>
                                </div>
                                {(form.bom || []).length === 0 && (
                                    <p className="text-xs text-gray-400 dark:text-zinc-500 italic">Sin insumos configurados.</p>
                                )}
                                {(form.bom || []).map((item: BomItem, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => {
                                                const bom = [...(form.bom || [])];
                                                bom[idx] = { ...bom[idx], name: e.target.value };
                                                setForm({ ...form, bom });
                                            }}
                                            placeholder="Nombre del insumo"
                                            className="flex-1 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        />
                                        <input
                                            type="number"
                                            step="any"
                                            min="0"
                                            value={item.qty || ''}
                                            onChange={(e) => {
                                                const bom = [...(form.bom || [])];
                                                bom[idx] = {
                                                    ...bom[idx],
                                                    qty: parseFloat(e.target.value) || 0
                                                };
                                                setForm({ ...form, bom });
                                            }}
                                            placeholder="Cant."
                                            className="w-24 p-2 border rounded-lg text-sm text-center focus:ring-2 focus:ring-orange-500 outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const bom = (form.bom || []).filter((_, i) => i !== idx);
                                                setForm({ ...form, bom });
                                            }}
                                            className="p-2 text-gray-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-zinc-300">
                                <input
                                    type="checkbox"
                                    checked={form.isActive ?? true}
                                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                    className="w-4 h-4 text-orange-600 dark:text-orange-400 rounded"
                                />
                                Producto activo
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
                                    {editing ? 'Guardar cambios' : 'Crear producto'}
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
