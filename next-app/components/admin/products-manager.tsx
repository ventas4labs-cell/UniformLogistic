'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Plus,
    Edit2,
    Trash2,
    Loader2,
    X,
    Package,
    Upload,
    CheckCircle2,
    ImageIcon,
    Sticker,
    Sparkles,
    Printer
} from 'lucide-react';
import type { AdminProduct, ProductInput, BomItem } from '@/lib/services/products';
import type { Company } from '@/lib/services/companies';
import type { Logo } from '@/lib/services/logos';
import {
    STAGE_ORDER,
    STAGE_LABELS,
    type StageKey
} from '@/lib/services/stage-completions';
import {
    createProductAction,
    updateProductAction,
    deleteProductAction,
    uploadProductImageAction
} from '@/app/(admin)/admin/products/actions';
import { validateCABYS } from '@/lib/facturacion/validation/cabys-validator';
import { VoiceProductDictate } from '@/components/admin/voice-product-dictate';
import { resizeImageFile } from '@/lib/resize-image';

const emptyForm: ProductInput = {
    productCode: '',
    name: '',
    description: '',
    imageUrl: '',
    productType: 'shirt',
    typeLabel: '',
    gender: 'unisex',
    sizes: { men: [], women: [], waist: [], inseam: [] },
    fabricType: '',
    isActive: true,
    bom: [],
    codigoCabys: '',
    companyIds: [],
    // New products default to every stage; admin unchecks the ones the
    // product doesn't need.
    stages: [...STAGE_ORDER]
};

const parseList = (input: string): string[] =>
    input.split(',').map((s) => s.trim()).filter(Boolean);

const parseNumList = (input: string): number[] =>
    parseList(input).map(Number).filter((n) => !Number.isNaN(n));

// Free-form decimal input that accepts both "." and "," as the decimal
// separator. Browsers' native type="number" silently rejects "," in
// many locales (en-US in particular), which made it impossible to enter
// values like 0,1 even though the rest of the UI is Spanish. Holds the
// raw typed string locally so partial input like "0," renders while the
// user is mid-type, and only flushes back a parsed number to the parent.
function DecimalInput({
    value,
    onChange,
    className,
    placeholder
}: {
    value: number;
    onChange: (next: number) => void;
    className?: string;
    placeholder?: string;
}) {
    const [text, setText] = useState(() =>
        Number.isFinite(value) && value > 0 ? String(value) : ''
    );
    const [focused, setFocused] = useState(false);

    // Re-sync when the parent value changes externally (e.g. form reset
    // or another row editing the same row's qty). Skip if the locally
    // typed text already represents the same number — that means the
    // change came from this input itself (a "0,5" → 0.5 round-trip)
    // and we don't want to clobber the user's literal "0,5" with "0.5".
    // Also skip while focused, as a belt-and-suspenders guard for
    // mid-typing states like "0," where the parsed value is 0.
    useEffect(() => {
        const parsed = parseFloat(text.replace(',', '.'));
        if (Number.isFinite(parsed) && parsed === value) return;
        if (focused) return;
        setText(Number.isFinite(value) && value > 0 ? String(value) : '');
    }, [value, focused, text]);

    return (
        <input
            type="text"
            inputMode="decimal"
            value={text}
            placeholder={placeholder}
            onFocus={() => setFocused(true)}
            onBlur={() => {
                setFocused(false);
                const normalized = text.replace(',', '.');
                const n = parseFloat(normalized);
                if (Number.isFinite(n) && n >= 0) {
                    setText(String(n));
                    onChange(n);
                } else {
                    setText('');
                    onChange(0);
                }
            }}
            onChange={(e) => {
                const raw = e.target.value;
                // Allow only digits and a single separator.
                if (!/^\d*[.,]?\d*$/.test(raw)) return;
                setText(raw);
                if (raw === '' || raw === '.' || raw === ',') {
                    onChange(0);
                    return;
                }
                const n = parseFloat(raw.replace(',', '.'));
                if (Number.isFinite(n) && n >= 0) onChange(n);
            }}
            className={className}
        />
    );
}

export function ProductsManager({
    initialProducts,
    companies,
    logos,
    embedded = false,
    autoOpenCreate = false,
    onClose
}: {
    initialProducts: AdminProduct[];
    companies: Company[];
    logos: Logo[];
    // Embedded mode renders ONLY the create/edit modal (no list/header),
    // so the form can be summoned as a popup from anywhere (top-bar fast
    // actions, home grid) without leaving the current page.
    embedded?: boolean;
    autoOpenCreate?: boolean;
    onClose?: () => void;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [editing, setEditing] = useState<AdminProduct | null>(null);
    const [showForm, setShowForm] = useState(autoOpenCreate);

    // Closing the form. In embedded mode also tell the host to unmount.
    const closeForm = () => {
        setShowForm(false);
        onClose?.();
    };
    const [form, setForm] = useState<ProductInput>(emptyForm);
    // Raw text for the comma-separated size inputs. Storing the typed
    // string separately from form.sizes (number[]/string[]) avoids the
    // "controlled input strips trailing comma" feedback loop: parsing
    // ",, " into [] and re-rendering the field would erase whatever the
    // user typed mid-keystroke. We parse into form.sizes for
    // submission, but the input value is always the raw text.
    const emptySizesText = { men: '', women: '', waist: '', inseam: '' };
    const [sizesText, setSizesText] = useState<{
        men: string;
        women: string;
        waist: string;
        inseam: string;
    }>(emptySizesText);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
    // Which BOM rows have their per-size override panel expanded. Index-
    // keyed so this resets naturally when the form is reopened.
    const [openOverrides, setOpenOverrides] = useState<Set<number>>(new Set());
    const [showLogoPicker, setShowLogoPicker] = useState(false);

    /** Rebuild raw size text from a form's parsed sizes — used on open + voice merges. */
    const sizesTextFromForm = (s: ProductInput['sizes']) => ({
        men: (s.men || []).join(', '),
        women: (s.women || []).join(', '),
        waist: (s.waist || []).join(', '),
        inseam: (s.inseam || []).join(', ')
    });

    const handleImageFile = async (file: File) => {
        setUploadingImage(true);
        setError(null);
        try {
            // Resize + re-encode in the browser before sending to the
            // server action. A 12 MP phone photo (8-15 MB) lands around
            // 400-800 KB after this, well under the Next.js / Vercel
            // body limits and the bucket's 5 MB cap.
            const { file: optimized } = await resizeImageFile(file);
            const fd = new FormData();
            fd.append('file', optimized);
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
        setSizesText(emptySizesText);
        setOpenOverrides(new Set());
        setShowForm(true);
        setError(null);
    };

    // Called by VoiceProductDictate after the LLM has parsed a dictation.
    // We merge the parsed fields over emptyForm so anything not detected
    // falls back to defaults (and the admin can edit before saving).
    const startCreateWithVoice = (patch: Partial<ProductInput>) => {
        setEditing(null);
        const mergedSizes = { ...emptyForm.sizes, ...(patch.sizes || {}) };
        setForm({
            ...emptyForm,
            ...patch,
            // Merge sizes per-bucket so a partial sizes patch doesn't blow
            // away keys the patch didn't touch.
            sizes: mergedSizes
        });
        setSizesText(sizesTextFromForm(mergedSizes));
        setShowForm(true);
        setError(null);
    };

    // Same merge logic but on top of the CURRENT form (used by the
    // mic button inside the open modal — typical use case is "edit
    // existing product and dictate a couple of corrections").
    const mergeVoiceIntoForm = (patch: Partial<ProductInput>) => {
        setForm((prev) => {
            const mergedSizes = { ...prev.sizes, ...(patch.sizes || {}) };
            // Only refresh sizesText for buckets the voice patch touched
            // so we don't clobber whatever the admin is mid-typing.
            if (patch.sizes) {
                setSizesText((t) => ({
                    ...t,
                    ...(patch.sizes!.men !== undefined
                        ? { men: (patch.sizes!.men || []).join(', ') }
                        : {}),
                    ...(patch.sizes!.women !== undefined
                        ? { women: (patch.sizes!.women || []).join(', ') }
                        : {}),
                    ...(patch.sizes!.waist !== undefined
                        ? { waist: (patch.sizes!.waist || []).join(', ') }
                        : {}),
                    ...(patch.sizes!.inseam !== undefined
                        ? { inseam: (patch.sizes!.inseam || []).join(', ') }
                        : {})
                }));
            }
            return { ...prev, ...patch, sizes: mergedSizes };
        });
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
            typeLabel: p.typeLabel || '',
            gender: p.category === 'Men' ? 'men' : p.category === 'Women' ? 'women' : 'unisex',
            sizes: p.sizes,
            fabricType: p.fabricType,
            isActive: p.isActive,
            bom: p.bom || [],
            codigoCabys: p.codigoCabys || '',
            companyIds: p.companyIds || [],
            // Empty stages on an existing product means "all stages"
            // (legacy) — show every box checked so the admin sees the
            // effective behaviour before narrowing it.
            stages: p.stages.length > 0 ? p.stages : [...STAGE_ORDER]
        });
        setSizesText(sizesTextFromForm(p.sizes));
        // Auto-expand the override panel for any BOM line that already
        // has per-size overrides — otherwise the admin would have to
        // hunt for them under a collapsed disclosure.
        const auto = new Set<number>();
        (p.bom || []).forEach((b, i) => {
            if (b.qtyBySize && Object.keys(b.qtyBySize).length > 0) auto.add(i);
        });
        setOpenOverrides(auto);
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
            onClose?.();
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
            {!embedded && (
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
                <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Productos</h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Catálogo maestro. Editá un producto y marcá las empresas
                        en &ldquo;Empresas asignadas&rdquo; para hacérselo
                        disponible.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                    <VoiceProductDictate onPrefill={startCreateWithVoice} />
                    <button
                        onClick={startCreate}
                        className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md flex items-center gap-2"
                    >
                        <Plus size={18} /> Nuevo Producto
                    </button>
                </div>
            </div>
            )}

            {!embedded && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full text-left min-w-[920px]">
                    <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-200 dark:border-zinc-800">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400 w-16"></th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Código</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Nombre</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Tipo</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Género</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Tela</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">CABYS</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Empresas</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Estado</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {initialProducts.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="p-8 text-center text-gray-500 dark:text-zinc-400">
                                    <Package size={32} className="mx-auto mb-2 opacity-30" />
                                    Sin productos registrados.
                                </td>
                            </tr>
                        ) : (
                            initialProducts.map((p) => (
                                <tr key={p.uuid} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                    <td className="p-4">
                                        {p.image ? (
                                            <button
                                                onClick={() => setPreviewImage({ src: p.image, alt: p.name })}
                                                className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 hover:ring-2 hover:ring-orange-400 transition-all cursor-pointer"
                                            >
                                                <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                            </button>
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                                                <ImageIcon size={16} className="text-gray-300 dark:text-zinc-600" />
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 font-mono text-xs text-gray-500 dark:text-zinc-400">{p.id}</td>
                                    <td className="p-4 font-bold text-gray-900 dark:text-zinc-100">{p.name}</td>
                                    <td className="p-4">
                                        <span
                                            className={`text-xs font-bold px-2 py-1 rounded-full ${p.type === 'shirt' ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300' : 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300'}`}
                                        >
                                            {p.typeLabel || (p.type === 'shirt' ? 'Camisa' : 'Pantalón')}
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
                                        {(() => {
                                            const n = p.companyIds?.length || 0;
                                            // Click the chip → opens the edit modal scrolled to
                                            // the "Empresas asignadas" section so admin can
                                            // toggle assignments without a separate tab.
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(p)}
                                                    title={
                                                        n === 0
                                                            ? 'Sin asignar a ninguna empresa — clic para asignar'
                                                            : `${n} empresa${n === 1 ? '' : 's'} asignada${n === 1 ? '' : 's'} — clic para editar`
                                                    }
                                                    className={`text-xs font-bold px-2 py-1 rounded-full transition-colors ${
                                                        n === 0
                                                            ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                                                            : 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-950/60'
                                                    }`}
                                                >
                                                    {n === 0
                                                        ? 'Sin empresas'
                                                        : `${n} empresa${n === 1 ? '' : 's'}`}
                                                </button>
                                            );
                                        })()}
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
            )}

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
                        <img
                            src={previewImage.src}
                            alt={previewImage.alt}
                            className="w-full h-auto max-h-[70vh] object-contain"
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
                            <h3 className="text-xl font-bold">{editing ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                            <div className="flex items-center gap-2">
                                <VoiceProductDictate
                                    mode={editing ? 'edit' : 'create'}
                                    onPrefill={mergeVoiceIntoForm}
                                />
                                <button
                                    onClick={closeForm}
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
                                    <input
                                        type="text"
                                        value={form.typeLabel || ''}
                                        onChange={(e) =>
                                            setForm({ ...form, typeLabel: e.target.value })
                                        }
                                        placeholder="ej. Camisa, Chaleco, Polo, Pantalón cargo"
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                        required
                                    />
                                    {/* Size-shape selector — drives whether the
                                        Tallas section shows shirt-style (S, M,
                                        L) or pant-style (cintura/inseam) inputs.
                                        Hidden under a small label so it doesn't
                                        compete with the free-text Tipo. */}
                                    <label className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500 dark:text-zinc-500">
                                        <span className="font-semibold">Tallaje:</span>
                                        <select
                                            value={form.productType}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    productType: e.target.value as 'shirt' | 'pant'
                                                })
                                            }
                                            className="bg-transparent border-b border-dotted border-gray-400 dark:border-zinc-600 outline-none focus:border-orange-500 px-0.5"
                                        >
                                            <option value="shirt">Camisa (S, M, L…)</option>
                                            <option value="pant">Pantalón (cintura)</option>
                                        </select>
                                    </label>
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
                                    Solo las empresas seleccionadas verán este producto en su catálogo.
                                </p>
                            </Field>

                            <Field label="Etapas necesarias">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg p-3">
                                    {STAGE_ORDER.map((stage) => {
                                        const checked = (form.stages || []).includes(stage);
                                        return (
                                            <label
                                                key={stage}
                                                className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        const set = new Set(form.stages || []);
                                                        if (e.target.checked) set.add(stage);
                                                        else set.delete(stage);
                                                        // Preserve canonical order.
                                                        setForm({
                                                            ...form,
                                                            stages: STAGE_ORDER.filter((s) =>
                                                                set.has(s)
                                                            ) as StageKey[]
                                                        });
                                                    }}
                                                    className="w-4 h-4 accent-orange-600"
                                                />
                                                <span className="font-medium">
                                                    {STAGE_LABELS[stage]}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                    El pedido solo aparece en los tableros de las etapas
                                    marcadas. Desmarcá las que este producto no necesita.
                                </p>
                            </Field>

                            {form.productType === 'shirt' ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Tallas Hombre (coma)">
                                        <input
                                            type="text"
                                            value={sizesText.men}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                setSizesText((t) => ({ ...t, men: raw }));
                                                setForm((f) => ({
                                                    ...f,
                                                    sizes: { ...f.sizes, men: parseList(raw) }
                                                }));
                                            }}
                                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                            placeholder="S, M, L, XL, 2XL"
                                        />
                                    </Field>
                                    <Field label="Tallas Mujer (coma)">
                                        <input
                                            type="text"
                                            value={sizesText.women}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                setSizesText((t) => ({ ...t, women: raw }));
                                                setForm((f) => ({
                                                    ...f,
                                                    sizes: { ...f.sizes, women: parseList(raw) }
                                                }));
                                            }}
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
                                            value={sizesText.waist}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                setSizesText((t) => ({ ...t, waist: raw }));
                                                setForm((f) => ({
                                                    ...f,
                                                    sizes: { ...f.sizes, waist: parseNumList(raw) }
                                                }));
                                            }}
                                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                            placeholder="30, 32, 34, 36"
                                        />
                                    </Field>
                                    <Field label="Largo / Inseam (opcional)">
                                        <input
                                            type="text"
                                            value={sizesText.inseam}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                setSizesText((t) => ({ ...t, inseam: raw }));
                                                setForm((f) => ({
                                                    ...f,
                                                    sizes: { ...f.sizes, inseam: parseNumList(raw) }
                                                }));
                                            }}
                                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                            placeholder="30, 32, 34"
                                        />
                                    </Field>
                                </div>
                            )}

                            <div className="border border-gray-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <label className="text-sm font-bold text-gray-700 dark:text-zinc-300">Insumos Requeridos (BOM)</label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowLogoPicker((s) => !s);
                                            }}
                                            className="text-xs bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 px-3 py-1 rounded-lg font-bold hover:bg-rose-100 dark:hover:bg-rose-950/50 flex items-center gap-1"
                                        >
                                            <Sticker size={14} /> Agregar logo
                                        </button>
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
                                </div>
                                {showLogoPicker && (
                                    <LogoMultiPickerModal
                                        logos={logos}
                                        selectedCompanyIds={form.companyIds || []}
                                        alreadyPickedIds={
                                            (form.bom || [])
                                                .map((b) => b.logoId)
                                                .filter((id): id is string => !!id)
                                        }
                                        onClose={() => setShowLogoPicker(false)}
                                        onConfirm={(picked) => {
                                            setForm((prev) => ({
                                                ...prev,
                                                bom: [
                                                    ...(prev.bom || []),
                                                    ...picked.map((l) => ({
                                                        name: l.name,
                                                        qty: 1,
                                                        logoId: l.id,
                                                        logoImageUrl: l.imageUrl,
                                                        logoCategory: l.category
                                                    }))
                                                ]
                                            }));
                                            setShowLogoPicker(false);
                                        }}
                                    />
                                )}
                                {(form.bom || []).length === 0 && (
                                    <p className="text-xs text-gray-400 dark:text-zinc-500 italic">Sin insumos configurados.</p>
                                )}
                                {(form.bom || []).map((item: BomItem, idx: number) => {
                                    // The pool of size labels we offer overrides for is
                                    // sizes.men ∪ sizes.women for shirts. Pants use waist
                                    // numbers; we skip per-size overrides there in v1
                                    // because the user's spec is XL+ shirt sizes.
                                    const sizePool: string[] =
                                        form.productType === 'shirt'
                                            ? Array.from(
                                                  new Set([
                                                      ...(form.sizes.men || []),
                                                      ...(form.sizes.women || [])
                                                  ])
                                              )
                                            : [];
                                    const overrides = item.qtyBySize || {};
                                    const isOpen = openOverrides.has(idx);
                                    const overrideCount = Object.values(overrides).filter(
                                        (v) => Number.isFinite(v) && v > 0
                                    ).length;
                                    const updateBom = (next: BomItem) => {
                                        const bom = [...(form.bom || [])];
                                        bom[idx] = next;
                                        setForm({ ...form, bom });
                                    };
                                    return (
                                        <div
                                            key={idx}
                                            className="space-y-2 border-b border-gray-100 dark:border-zinc-800 pb-3 last:border-b-0 last:pb-0"
                                        >
                                            <div className="flex items-center gap-2">
                                                {item.logoId ? (
                                                    <div className="flex-1 flex items-center gap-2 p-1.5 pl-2 border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 rounded-lg min-w-0">
                                                        {item.logoImageUrl ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={item.logoImageUrl}
                                                                alt={item.name}
                                                                className="w-8 h-8 object-contain bg-white border border-gray-100 dark:border-zinc-800 rounded shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                                                <Sticker size={12} className="text-gray-400" />
                                                            </div>
                                                        )}
                                                        <span className="font-bold text-sm text-gray-900 dark:text-zinc-100 truncate">
                                                            {item.name}
                                                        </span>
                                                        {item.logoCategory && (
                                                            <span
                                                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                                                    item.logoCategory === 'bordado'
                                                                        ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300'
                                                                        : 'bg-pink-100 dark:bg-pink-950/50 text-pink-800 dark:text-pink-300'
                                                                }`}
                                                            >
                                                                {item.logoCategory === 'bordado' ? (
                                                                    <Sparkles size={10} />
                                                                ) : (
                                                                    <Printer size={10} />
                                                                )}
                                                                {item.logoCategory === 'bordado' ? 'Bordado' : 'Impresión'}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) =>
                                                            updateBom({ ...item, name: e.target.value })
                                                        }
                                                        placeholder="Nombre del insumo"
                                                        className="flex-1 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                                    />
                                                )}
                                                <DecimalInput
                                                    value={item.qty}
                                                    onChange={(qty) =>
                                                        updateBom({ ...item, qty })
                                                    }
                                                    placeholder="Cant."
                                                    className="w-24 p-2 border rounded-lg text-sm text-center focus:ring-2 focus:ring-orange-500 outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const bom = (form.bom || []).filter(
                                                            (_, i) => i !== idx
                                                        );
                                                        setForm({ ...form, bom });
                                                        setOpenOverrides((s) => {
                                                            const n = new Set<number>();
                                                            s.forEach((i) => {
                                                                if (i < idx) n.add(i);
                                                                else if (i > idx) n.add(i - 1);
                                                            });
                                                            return n;
                                                        });
                                                    }}
                                                    className="p-2 text-gray-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            {item.logoId && (
                                                <input
                                                    type="text"
                                                    value={item.logoPlacement || ''}
                                                    onChange={(e) =>
                                                        updateBom({
                                                            ...item,
                                                            logoPlacement: e.target.value
                                                        })
                                                    }
                                                    placeholder="Ubicación / instrucción en este producto (ej: pecho izquierdo, 8 cm)"
                                                    className="w-full p-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-zinc-900"
                                                />
                                            )}

                                            {sizePool.length > 0 && (
                                                <div className="pl-1">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setOpenOverrides((s) => {
                                                                const n = new Set(s);
                                                                if (n.has(idx)) n.delete(idx);
                                                                else n.add(idx);
                                                                return n;
                                                            })
                                                        }
                                                        className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
                                                    >
                                                        <span>{isOpen ? '▾' : '▸'}</span>
                                                        Recargo por talla
                                                        {overrideCount > 0 && (
                                                            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/40 text-[10px]">
                                                                {overrideCount}
                                                            </span>
                                                        )}
                                                    </button>

                                                    {isOpen && (
                                                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                                            {sizePool.map((sz) => {
                                                                const current = overrides[sz];
                                                                return (
                                                                    <label
                                                                        key={sz}
                                                                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800"
                                                                    >
                                                                        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-400 w-8 shrink-0">
                                                                            {sz}
                                                                        </span>
                                                                        <DecimalInput
                                                                            value={
                                                                                current !== undefined &&
                                                                                Number.isFinite(current)
                                                                                    ? current
                                                                                    : 0
                                                                            }
                                                                            onChange={(n) => {
                                                                                const next = { ...overrides };
                                                                                if (Number.isFinite(n) && n > 0) {
                                                                                    next[sz] = n;
                                                                                } else {
                                                                                    delete next[sz];
                                                                                }
                                                                                updateBom({
                                                                                    ...item,
                                                                                    qtyBySize:
                                                                                        Object.keys(next).length > 0
                                                                                            ? next
                                                                                            : undefined
                                                                                });
                                                                            }}
                                                                            placeholder={
                                                                                item.qty
                                                                                    ? String(item.qty)
                                                                                    : '—'
                                                                            }
                                                                            className="w-full min-w-0 px-1.5 py-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded text-xs text-center focus:ring-2 focus:ring-orange-500 outline-none"
                                                                        />
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    {isOpen && (
                                                        <p className="mt-2 text-[10px] text-gray-500 dark:text-zinc-500 italic">
                                                            Dejá vacío para usar la cantidad base
                                                            ({item.qty || 0}). Útil para XXL, XXXL,
                                                            XXXXL, XXXXXL que llevan más tela.
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
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

// Multi-select logo picker rendered as its own overlay above the
// product-form modal. Local `selected` state lets the admin pick many
// logos before committing; parent's onConfirm appends them all as BOM
// rows in one atomic setForm call.
function LogoMultiPickerModal({
    logos,
    selectedCompanyIds,
    alreadyPickedIds,
    onClose,
    onConfirm
}: {
    logos: Logo[];
    selectedCompanyIds: string[];
    alreadyPickedIds: string[];
    onClose: () => void;
    onConfirm: (logos: Logo[]) => void;
}) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [showAllCompanies, setShowAllCompanies] = useState(false);

    const selectedCompanies = new Set(selectedCompanyIds);
    const alreadyPicked = new Set(alreadyPickedIds);

    // If the admin hasn't picked any companies (or explicitly asks to
    // see all), fall back to all active logos. Otherwise restrict to
    // logos assigned to at least one of the selected companies.
    const available = logos.filter((l) => {
        if (!l.isActive) return false;
        if (alreadyPicked.has(l.id)) return false;
        if (selectedCompanies.size === 0 || showAllCompanies) return true;
        return l.companyIds.some((c) => selectedCompanies.has(c));
    });

    const filtered = search.trim()
        ? available.filter((l) =>
              l.name.toLowerCase().includes(search.trim().toLowerCase())
          )
        : available;

    const toggle = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAllVisible = () => {
        setSelected((prev) => {
            const next = new Set(prev);
            for (const l of filtered) next.add(l.id);
            return next;
        });
    };

    const clearSelection = () => setSelected(new Set());

    const handleConfirm = () => {
        const picked = logos.filter((l) => selected.has(l.id));
        onConfirm(picked);
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                            <Sticker size={18} className="text-rose-500" />
                            Agregar logos al BOM
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                            Seleccioná uno o más logos. Se agregan como
                            líneas individuales del BOM.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 border-b border-gray-100 dark:border-zinc-800 space-y-2">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por nombre…"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-rose-400 outline-none"
                    />
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-xs">
                            <button
                                type="button"
                                onClick={selectAllVisible}
                                disabled={filtered.length === 0}
                                className="font-bold text-rose-600 dark:text-rose-400 hover:underline disabled:text-gray-400 dark:disabled:text-zinc-600 disabled:no-underline"
                            >
                                Seleccionar todos
                            </button>
                            {selected.size > 0 && (
                                <>
                                    <span className="text-gray-300 dark:text-zinc-700">|</span>
                                    <button
                                        type="button"
                                        onClick={clearSelection}
                                        className="font-bold text-gray-500 dark:text-zinc-400 hover:underline"
                                    >
                                        Limpiar ({selected.size})
                                    </button>
                                </>
                            )}
                        </div>
                        {selectedCompanies.size > 0 && (
                            <label className="text-xs text-gray-600 dark:text-zinc-400 inline-flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showAllCompanies}
                                    onChange={(e) => setShowAllCompanies(e.target.checked)}
                                    className="rounded"
                                />
                                Mostrar todos (no filtrar por empresa)
                            </label>
                        )}
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-4">
                    {filtered.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-zinc-400 italic text-center py-8">
                            {logos.length === 0
                                ? 'No hay logos creados. Crealos en la pestaña "Logos".'
                                : available.length === 0
                                  ? selectedCompanies.size === 0
                                      ? 'No hay logos disponibles.'
                                      : 'Ninguno de los logos disponibles está asignado a las empresas seleccionadas.'
                                  : 'Ningún logo coincide con la búsqueda.'}
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {filtered.map((l) => {
                                const isSelected = selected.has(l.id);
                                return (
                                    <button
                                        key={l.id}
                                        type="button"
                                        onClick={() => toggle(l.id)}
                                        className={`relative flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                                            isSelected
                                                ? 'bg-rose-100 dark:bg-rose-950/50 border-rose-400 dark:border-rose-500 shadow-sm ring-2 ring-rose-300 dark:ring-rose-800'
                                                : 'bg-white dark:bg-zinc-900 border-rose-200 dark:border-rose-900/40 hover:border-rose-400 hover:shadow-sm'
                                        }`}
                                        aria-pressed={isSelected}
                                    >
                                        {isSelected && (
                                            <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow">
                                                <CheckCircle2 size={14} strokeWidth={3} />
                                            </span>
                                        )}
                                        {l.imageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={l.imageUrl}
                                                alt={l.name}
                                                className="w-12 h-12 object-contain bg-white border border-gray-100 dark:border-zinc-800 rounded shrink-0"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                                <ImageIcon size={16} className="text-gray-300 dark:text-zinc-600" />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1 pr-6">
                                            <div className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">
                                                {l.name}
                                            </div>
                                            <div
                                                className={`inline-flex items-center gap-1 text-[10px] font-bold mt-0.5 px-1.5 py-0.5 rounded-full ${
                                                    l.category === 'bordado'
                                                        ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300'
                                                        : 'bg-pink-100 dark:bg-pink-950/50 text-pink-800 dark:text-pink-300'
                                                }`}
                                            >
                                                {l.category === 'bordado' ? (
                                                    <Sparkles size={10} />
                                                ) : (
                                                    <Printer size={10} />
                                                )}
                                                {l.category === 'bordado' ? 'Bordado' : 'Impresión'}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex gap-3 p-4 border-t border-gray-100 dark:border-zinc-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={selected.size === 0}
                        className="flex-1 py-2.5 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 disabled:bg-gray-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Plus size={16} />
                        {selected.size === 0
                            ? 'Elegí al menos uno'
                            : `Agregar ${selected.size} logo${selected.size === 1 ? '' : 's'}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
