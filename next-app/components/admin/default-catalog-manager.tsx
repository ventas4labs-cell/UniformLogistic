'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Plus,
    Edit2,
    Trash2,
    Loader2,
    X,
    Upload,
    ImageIcon,
    Package,
    Sticker,
    EyeOff,
    Eye
} from 'lucide-react';
import type {
    CatalogItem,
    CatalogItemInput,
    CatalogProductType,
    CatalogColor,
    CatalogImage
} from '@/lib/services/catalog-items';
import {
    createCatalogItemAction,
    updateCatalogItemAction,
    deleteCatalogItemAction,
    uploadCatalogImageAction
} from '@/app/(admin)/admin/catalogo-default/actions';
import { resizeImageFile } from '@/lib/resize-image';

const emptyForm: CatalogItemInput = {
    code: '',
    name: '',
    description: '',
    imageUrl: '',
    productType: 'shirt',
    category: '',
    images: [],
    fabricType: '',
    fabricOptions: [],
    colorOptions: [],
    unitPrice: 0,
    pricePerLogo: 0,
    maxLogos: 0,
    isActive: true,
    sortOrder: 0
};

// Common color names → swatch hex, for auto-adding a color from the
// image filename's second word. Covers EN + ES; unknown names fall
// back to a neutral gray so the swatch still renders.
const COLOR_HEX: Record<string, string> = {
    white: '#ffffff', blanco: '#ffffff',
    black: '#111111', negro: '#111111',
    red: '#dc2626', rojo: '#dc2626',
    blue: '#2563eb', azul: '#2563eb',
    navy: '#1e3a8a', marino: '#1e3a8a',
    green: '#16a34a', verde: '#16a34a',
    gray: '#9ca3af', grey: '#9ca3af', gris: '#9ca3af',
    yellow: '#facc15', amarillo: '#facc15',
    orange: '#ea580c', naranja: '#ea580c',
    purple: '#7c3aed', morado: '#7c3aed',
    pink: '#ec4899', rosa: '#ec4899',
    brown: '#92400e', cafe: '#92400e', café: '#92400e', marron: '#92400e',
    beige: '#d6c7a1',
    turquoise: '#14b8a6', turquesa: '#14b8a6',
    celeste: '#38bdf8'
};

const titleCase = (s: string) =>
    s
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();

// Parse "POLO WHITE.jpg" (or polo-white, Tshirt_Black…) into its parts.
// First word → category, second → color name, whole → pretty product
// name. Returns empty strings for anything absent.
function parseFilenameMeta(filename: string): {
    category: string;
    colorName: string;
    prettyName: string;
} {
    const base = filename.replace(/\.[^.]+$/, '');
    const words = base
        .split(/[\s_-]+/)
        .map((w) => w.trim())
        .filter(Boolean);
    return {
        category: words[0] ? titleCase(words[0]) : '',
        colorName: words[1] ? titleCase(words[1]) : '',
        prettyName: words.length ? titleCase(words.join(' ')) : ''
    };
}

const PRODUCT_TYPE_LABEL: Record<CatalogProductType, string> = {
    shirt: 'Camisa',
    pant: 'Pantalón',
    other: 'Otro'
};

const formatCRC = (n: number) =>
    new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: 'CRC',
        maximumFractionDigits: 0
    }).format(n);

export function DefaultCatalogManager({
    initialItems
}: {
    initialItems: CatalogItem[];
}) {
    const [items, setItems] = useState<CatalogItem[]>(initialItems);
    // Reconcile with server truth after every router.refresh(). Without
    // this, the useState above only runs its initializer on mount, so
    // the list could keep stale optimistic rows (e.g. one carrying a
    // fabricated id) even after a refresh — which is what let a saved
    // item be edited under a non-existent id.
    useEffect(() => {
        setItems(initialItems);
    }, [initialItems]);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<CatalogItem | null>(null);
    const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
    };

    const openEdit = (it: CatalogItem) => {
        setEditing(it);
        setFormOpen(true);
    };

    const handleSaved = (saved: CatalogItem, isNew: boolean) => {
        setItems((prev) =>
            isNew
                ? [...prev, saved].sort(
                      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
                  )
                : prev.map((p) => (p.id === saved.id ? saved : p))
        );
        setFormOpen(false);
        router.refresh();
    };

    const handleDelete = async () => {
        if (!deletingItem) return;
        setDeleting(true);
        try {
            await deleteCatalogItemAction(deletingItem.id);
            setItems((prev) => prev.filter((p) => p.id !== deletingItem.id));
            setDeletingItem(null);
            router.refresh();
        } catch (e) {
            alert(`Error al eliminar: ${e instanceof Error ? e.message : e}`);
        } finally {
            setDeleting(false);
        }
    };

    const toggleActive = (it: CatalogItem) => {
        const next: CatalogItemInput = {
            code: it.code,
            name: it.name,
            description: it.description,
            imageUrl: it.imageUrl,
            productType: it.productType,
            category: it.category,
            images: it.images,
            fabricType: it.fabricType,
            fabricOptions: it.fabricOptions,
            colorOptions: it.colorOptions,
            unitPrice: it.unitPrice,
            pricePerLogo: it.pricePerLogo,
            maxLogos: it.maxLogos,
            isActive: !it.isActive,
            sortOrder: it.sortOrder
        };
        setItems((prev) =>
            prev.map((p) => (p.id === it.id ? { ...p, isActive: !p.isActive } : p))
        );
        startTransition(async () => {
            try {
                await updateCatalogItemAction(it.id, next);
            } catch (e) {
                alert(`Error al cambiar estado: ${e instanceof Error ? e.message : e}`);
                router.refresh();
            }
        });
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <Package size={24} className="text-orange-600 dark:text-orange-400" />
                        Catálogo default
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Productos genéricos con precio de referencia — se usan
                        en el cotizador para armar propuestas rápido.
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md flex items-center gap-2"
                >
                    <Plus size={18} /> Nuevo item
                </button>
            </div>

            {items.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400">
                    Sin items en el catálogo. Agregá el primero con
                    &ldquo;Nuevo item&rdquo;.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {items.map((it) => (
                        <div
                            key={it.id}
                            className={`bg-white dark:bg-zinc-900 rounded-xl shadow-sm border overflow-hidden ${
                                it.isActive
                                    ? 'border-gray-200 dark:border-zinc-800'
                                    : 'border-dashed border-gray-300 dark:border-zinc-700 opacity-70'
                            }`}
                        >
                            <div className="relative aspect-[4/3] bg-gray-100 dark:bg-zinc-800">
                                {it.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={it.imageUrl}
                                        alt={it.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <ImageIcon
                                            size={40}
                                            className="text-gray-300 dark:text-zinc-600"
                                        />
                                    </div>
                                )}
                                {!it.isActive && (
                                    <span className="absolute top-2 left-2 bg-gray-800/80 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                                        Inactivo
                                    </span>
                                )}
                                <span className="absolute top-2 right-2 bg-white/95 dark:bg-zinc-900/95 text-gray-700 dark:text-zinc-300 text-[10px] font-mono px-2 py-0.5 rounded shadow">
                                    {it.code}
                                </span>
                            </div>
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-gray-900 dark:text-zinc-100 truncate">
                                            {it.name}
                                        </h3>
                                        {it.category && (
                                            <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wide bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 px-1.5 py-0.5 rounded">
                                                {it.category}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs font-bold text-gray-500 dark:text-zinc-500 shrink-0">
                                        {PRODUCT_TYPE_LABEL[it.productType]}
                                    </span>
                                </div>
                                {it.description && (
                                    <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2 mb-3">
                                        {it.description}
                                    </p>
                                )}
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                                        {formatCRC(it.unitPrice)}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-zinc-400 inline-flex items-center gap-1">
                                        <Sticker size={12} />
                                        {it.maxLogos === 0
                                            ? 'Sin logo'
                                            : `Hasta ${it.maxLogos} logo${it.maxLogos === 1 ? '' : 's'}`}
                                    </span>
                                </div>
                                {it.fabricType && (
                                    <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-zinc-500 mb-3">
                                        Tela: <span className="font-bold">{it.fabricType}</span>
                                    </p>
                                )}
                                <div className="grid grid-cols-3 gap-1 pt-2 border-t border-gray-100 dark:border-zinc-800">
                                    <button
                                        onClick={() => openEdit(it)}
                                        className="flex items-center justify-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 py-2 rounded"
                                    >
                                        <Edit2 size={12} /> Editar
                                    </button>
                                    <button
                                        onClick={() => toggleActive(it)}
                                        disabled={pending}
                                        className="flex items-center justify-center gap-1 text-xs font-bold text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 py-2 rounded"
                                    >
                                        {it.isActive ? (
                                            <>
                                                <EyeOff size={12} /> Ocultar
                                            </>
                                        ) : (
                                            <>
                                                <Eye size={12} /> Activar
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setDeletingItem(it)}
                                        className="flex items-center justify-center gap-1 text-xs font-bold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 py-2 rounded"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {formOpen && (
                <CatalogItemFormModal
                    existing={editing}
                    onClose={() => setFormOpen(false)}
                    onSaved={handleSaved}
                />
            )}

            {deletingItem && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => !deleting && setDeletingItem(null)}
                >
                    <div
                        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-2">
                            ¿Eliminar {deletingItem.name}?
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-5">
                            El item se elimina del catálogo. Cotizaciones que ya
                            lo hayan usado conservan una copia del nombre y
                            precio de ese momento.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingItem(null)}
                                disabled={deleting}
                                className="flex-1 py-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
                            >
                                {deleting && <Loader2 className="animate-spin" size={16} />}
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function CatalogItemFormModal({
    existing,
    onClose,
    onSaved
}: {
    existing: CatalogItem | null;
    onClose: () => void;
    onSaved: (saved: CatalogItem, isNew: boolean) => void;
}) {
    const [form, setForm] = useState<CatalogItemInput>(
        existing
            ? {
                  code: existing.code,
                  name: existing.name,
                  description: existing.description,
                  imageUrl: existing.imageUrl,
                  productType: existing.productType,
                  category: existing.category,
                  images: existing.images,
                  fabricType: existing.fabricType,
                  fabricOptions: existing.fabricOptions,
                  colorOptions: existing.colorOptions,
                  unitPrice: existing.unitPrice,
                  pricePerLogo: existing.pricePerLogo,
                  maxLogos: existing.maxLogos,
                  isActive: existing.isActive,
                  sortOrder: existing.sortOrder
              }
            : emptyForm
    );
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Upload one or many files at once. Each file follows the
    // "TIPO COLOR" convention: its color tags the gallery image (so the
    // configurator can swap image on color select) and is added as a
    // color option; the first word sets the category; the product name
    // (if empty) becomes the category. Resize happens client-side first
    // to stay under the Server Action body limit.
    const handleUpload = async (files: File[]) => {
        if (files.length === 0) return;
        setUploading(true);
        setError(null);
        try {
            const uploaded: { url: string; category: string; colorName: string }[] = [];
            for (const file of files) {
                const meta = parseFilenameMeta(file.name);
                const { file: resized } = await resizeImageFile(file);
                const fd = new FormData();
                fd.append('file', resized);
                const url = await uploadCatalogImageAction(fd);
                uploaded.push({
                    url,
                    category: meta.category,
                    colorName: meta.colorName
                });
            }

            setForm((f) => {
                const images: CatalogImage[] = [...(f.images ?? [])];
                const colorOptions: CatalogColor[] = [...(f.colorOptions ?? [])];
                for (const u of uploaded) {
                    if (!images.some((im) => im.url === u.url)) {
                        images.push({ url: u.url, color: u.colorName });
                    }
                    if (
                        u.colorName &&
                        !colorOptions.some(
                            (c) => c.name.toLowerCase() === u.colorName.toLowerCase()
                        )
                    ) {
                        colorOptions.push({
                            name: u.colorName,
                            hex: COLOR_HEX[u.colorName.toLowerCase()] ?? '#9ca3af'
                        });
                    }
                }
                // Category = first uploaded file's first word (the item
                // family, e.g. POLO). The color is a variant, so it does
                // NOT go into the name.
                const derivedCategory =
                    uploaded.find((u) => u.category)?.category || '';
                return {
                    ...f,
                    images,
                    // Primary/thumbnail = first gallery image.
                    imageUrl: images[0]?.url ?? '',
                    category: derivedCategory || f.category,
                    name: f.name.trim() ? f.name : derivedCategory,
                    colorOptions
                };
            });
        } catch (e) {
            setError(`Error subiendo imagen: ${e instanceof Error ? e.message : e}`);
        } finally {
            setUploading(false);
        }
    };

    const removeImage = (url: string) => {
        setForm((f) => {
            const images = (f.images ?? []).filter((im) => im.url !== url);
            return { ...f, images, imageUrl: images[0]?.url ?? '' };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.code.trim() || !form.name.trim()) {
            setError('Código y nombre son obligatorios.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            // Both actions return the canonical DB row — use it so the
            // client always holds the real id (a fabricated id made the
            // next edit update 0 rows → PGRST116).
            if (existing) {
                const saved = await updateCatalogItemAction(existing.id, form);
                onSaved(saved, false);
            } else {
                const saved = await createCatalogItemAction(form);
                onSaved(saved, true);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <form
                onSubmit={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col"
            >
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
                    <h3 className="text-lg font-bold">
                        {existing ? 'Editar item' : 'Nuevo item de catálogo'}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto p-5 space-y-4 flex-1">
                    <div className="grid grid-cols-3 gap-3">
                        <Field label="Código *">
                            <input
                                required
                                type="text"
                                value={form.code}
                                onChange={(e) => setForm({ ...form, code: e.target.value })}
                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="CAM-001"
                            />
                        </Field>
                        <Field label="Tipo">
                            <select
                                value={form.productType}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        productType: e.target.value as CatalogProductType
                                    })
                                }
                                className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-orange-500 outline-none"
                            >
                                <option value="shirt">Camisa</option>
                                <option value="pant">Pantalón</option>
                                <option value="other">Otro</option>
                            </select>
                        </Field>
                        <Field label="Orden">
                            <input
                                type="number"
                                value={form.sortOrder ?? 0}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        sortOrder: parseInt(e.target.value, 10) || 0
                                    })
                                }
                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Nombre *">
                            <input
                                required
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="Camisa Columbia Azul"
                            />
                        </Field>
                        <Field label="Categoría">
                            <input
                                type="text"
                                value={form.category ?? ''}
                                onChange={(e) =>
                                    setForm({ ...form, category: e.target.value })
                                }
                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="Se completa desde el nombre del archivo (POLO, TSHIRT…)"
                            />
                        </Field>
                    </div>

                    <Field label="Descripción">
                        <textarea
                            value={form.description ?? ''}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            rows={2}
                            className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            placeholder="Uso, características…"
                        />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Tela">
                            <input
                                type="text"
                                value={form.fabricType ?? ''}
                                onChange={(e) => setForm({ ...form, fabricType: e.target.value })}
                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="Ripstop, Columbia…"
                            />
                        </Field>
                        <Field label="Precio unitario (₡) *">
                            <input
                                required
                                type="number"
                                min="0"
                                step="1"
                                value={form.unitPrice}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        unitPrice: parseFloat(e.target.value) || 0
                                    })
                                }
                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Cantidad máxima de logos">
                            <input
                                type="number"
                                min="0"
                                max="10"
                                value={form.maxLogos}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        maxLogos: Math.max(
                                            0,
                                            Math.min(10, parseInt(e.target.value, 10) || 0)
                                        )
                                    })
                                }
                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </Field>
                        <Field label="Precio por logo (₡)">
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={form.pricePerLogo ?? 0}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        pricePerLogo: parseFloat(e.target.value) || 0
                                    })
                                }
                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-40"
                                disabled={(form.maxLogos ?? 0) === 0}
                                title={
                                    (form.maxLogos ?? 0) === 0
                                        ? 'Subí la cantidad máxima de logos primero'
                                        : ''
                                }
                            />
                        </Field>
                    </div>

                    <Field label="Telas disponibles">
                        <FabricOptionsEditor
                            value={form.fabricOptions ?? []}
                            onChange={(fabricOptions) => setForm({ ...form, fabricOptions })}
                        />
                    </Field>

                    <Field label="Colores disponibles">
                        <ColorOptionsEditor
                            value={form.colorOptions ?? []}
                            onChange={(colorOptions) => setForm({ ...form, colorOptions })}
                        />
                    </Field>

                    <Field label="Imágenes">
                        <div className="space-y-3">
                            {(form.images ?? []).length > 0 && (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {(form.images ?? []).map((im, idx) => (
                                        <div
                                            key={im.url}
                                            className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800"
                                        >
                                            <div className="aspect-square">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={im.url}
                                                    alt={im.color || 'imagen'}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            {idx === 0 && (
                                                <span className="absolute top-1 left-1 bg-orange-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                                                    Principal
                                                </span>
                                            )}
                                            <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] font-bold px-1.5 py-0.5 truncate">
                                                {im.color || 'Sin color'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeImage(im.url)}
                                                className="absolute top-1 right-1 bg-black/50 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                aria-label="Quitar imagen"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded-lg font-bold text-xs cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700">
                                {uploading ? (
                                    <Loader2 className="animate-spin" size={14} />
                                ) : (
                                    <Upload size={14} />
                                )}
                                {uploading ? 'Subiendo…' : 'Subir imágenes'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    disabled={uploading}
                                    onChange={(e) => {
                                        const fs = Array.from(e.target.files ?? []);
                                        // Reset so re-picking the same files fires change.
                                        e.target.value = '';
                                        if (fs.length) handleUpload(fs);
                                    }}
                                />
                            </label>
                            <p className="text-[11px] text-gray-500 dark:text-zinc-500">
                                Nombrá cada archivo como{' '}
                                <span className="font-mono font-bold">TIPO COLOR</span>{' '}
                                (ej. <span className="font-mono">POLO WHITE</span>,{' '}
                                <span className="font-mono">POLO BLACK</span>). Podés
                                subir varias a la vez: cada color se agrega solo y en
                                el cotizador la imagen cambia según el color que elija
                                el cliente.
                            </p>
                        </div>
                    </Field>

                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={form.isActive ?? true}
                            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                        />
                        Activo (aparece en el cotizador)
                    </label>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/50">
                            {error}
                        </div>
                    )}
                </div>

                <div className="flex gap-3 p-5 border-t border-gray-100 dark:border-zinc-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving || uploading}
                        className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
                    >
                        {saving && <Loader2 className="animate-spin" size={16} />}
                        Guardar
                    </button>
                </div>
            </form>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-400 mb-1">
                {label}
            </label>
            {children}
        </div>
    );
}

// Chip editor for the fabric list the customer can pick from. Type a
// name, Enter or "+" adds it; each chip has an ✕ to remove.
function FabricOptionsEditor({
    value,
    onChange
}: {
    value: string[];
    onChange: (next: string[]) => void;
}) {
    const [draft, setDraft] = useState('');

    const add = () => {
        const v = draft.trim();
        if (!v) return;
        // Case-insensitive dedupe so "Ripstop" and "ripstop" don't both land.
        if (value.some((f) => f.toLowerCase() === v.toLowerCase())) {
            setDraft('');
            return;
        }
        onChange([...value, v]);
        setDraft('');
    };

    return (
        <div>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            add();
                        }
                    }}
                    placeholder="Ripstop, Columbia, Gabardina…"
                    className="flex-1 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
                <button
                    type="button"
                    onClick={add}
                    className="px-3 py-2 bg-gray-100 dark:bg-zinc-800 rounded-lg text-sm font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                >
                    <Plus size={14} />
                </button>
            </div>
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {value.map((f) => (
                        <span
                            key={f}
                            className="inline-flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 text-xs font-bold px-2 py-1 rounded-full"
                        >
                            {f}
                            <button
                                type="button"
                                onClick={() => onChange(value.filter((x) => x !== f))}
                                className="text-gray-400 hover:text-red-500"
                                aria-label={`Quitar ${f}`}
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// Chip editor for color options: a color picker + name → swatch chips.
function ColorOptionsEditor({
    value,
    onChange
}: {
    value: CatalogColor[];
    onChange: (next: CatalogColor[]) => void;
}) {
    const [name, setName] = useState('');
    const [hex, setHex] = useState('#2563eb');

    const add = () => {
        const n = name.trim();
        if (!n) return;
        if (value.some((c) => c.name.toLowerCase() === n.toLowerCase())) {
            setName('');
            return;
        }
        onChange([...value, { name: n, hex }]);
        setName('');
    };

    return (
        <div>
            <div className="flex gap-2">
                <input
                    type="color"
                    value={hex}
                    onChange={(e) => setHex(e.target.value)}
                    className="h-9 w-12 rounded border border-gray-200 dark:border-zinc-700 cursor-pointer shrink-0"
                    aria-label="Color"
                />
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            add();
                        }
                    }}
                    placeholder="Azul marino, Negro…"
                    className="flex-1 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
                <button
                    type="button"
                    onClick={add}
                    className="px-3 py-2 bg-gray-100 dark:bg-zinc-800 rounded-lg text-sm font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                >
                    <Plus size={14} />
                </button>
            </div>
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {value.map((c) => (
                        <span
                            key={c.name}
                            className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 text-xs font-bold px-2 py-1 rounded-full"
                        >
                            <span
                                className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                                style={{ backgroundColor: c.hex }}
                            />
                            {c.name}
                            <button
                                type="button"
                                onClick={() =>
                                    onChange(value.filter((x) => x.name !== c.name))
                                }
                                className="text-gray-400 hover:text-red-500"
                                aria-label={`Quitar ${c.name}`}
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
