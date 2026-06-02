'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    Boxes,
    Edit2,
    Loader2,
    Minus,
    Package2,
    Plus,
    Trash2,
    X
} from 'lucide-react';
import type { Material, MaterialInput } from '@/lib/services/materials';
import { CollapsibleSearch } from '@/components/admin/collapsible-search';
import {
    adjustMaterialQtyAction,
    createMaterialAction,
    deleteMaterialAction,
    updateMaterialAction
} from '@/app/(admin)/admin/materials/actions';

// Common Spanish units offered as defaults — admin can still type any
// free-form value because the DB column is plain text.
const UNIT_SUGGESTIONS = ['unidad', 'metros', 'yardas', 'rollos', 'kilos', 'litros', 'pares'];

const emptyForm: MaterialInput = {
    name: '',
    unit: 'unidad',
    category: '',
    currentQty: 0,
    minQty: 0,
    unitCost: 0,
    supplier: '',
    notes: '',
    isActive: true
};

export function MaterialsManager({
    initialMaterials
}: {
    initialMaterials: Material[];
}) {
    const router = useRouter();
    const [materials, setMaterials] = useState<Material[]>(initialMaterials);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [showLowStock, setShowLowStock] = useState(false);
    const [editing, setEditing] = useState<Material | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState<MaterialInput>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [busyId, setBusyId] = useState<string | null>(null);

    const distinctCategories = useMemo(
        () =>
            Array.from(
                new Set(
                    materials
                        .map((m) => m.category.trim())
                        .filter((c) => c.length > 0)
                )
            ).sort((a, b) => a.localeCompare(b)),
        [materials]
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return materials.filter((m) => {
            if (categoryFilter !== 'all') {
                if ((m.category || '').toLowerCase() !== categoryFilter.toLowerCase())
                    return false;
            }
            if (showLowStock && !isLowStock(m)) return false;
            if (!q) return true;
            return (
                m.name.toLowerCase().includes(q) ||
                m.category.toLowerCase().includes(q) ||
                m.supplier.toLowerCase().includes(q)
            );
        });
    }, [materials, search, categoryFilter, showLowStock]);

    const lowStockCount = useMemo(
        () => materials.filter(isLowStock).length,
        [materials]
    );

    const startCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setError(null);
        setCreating(true);
    };

    const startEdit = (m: Material) => {
        setEditing(m);
        setForm({
            name: m.name,
            unit: m.unit,
            category: m.category,
            currentQty: m.currentQty,
            minQty: m.minQty,
            unitCost: m.unitCost,
            supplier: m.supplier,
            notes: m.notes,
            isActive: m.isActive
        });
        setError(null);
        setCreating(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) {
            setError('El nombre es obligatorio.');
            return;
        }
        setSaving(true);
        setError(null);
        const res = editing
            ? await updateMaterialAction(editing.id, form)
            : await createMaterialAction(form);
        setSaving(false);
        if (res.error) {
            setError(res.error);
            return;
        }
        setCreating(false);
        router.refresh();
    };

    const handleAdjust = (m: Material, delta: number) => {
        setBusyId(m.id);
        // Optimistic local update.
        setMaterials((prev) =>
            prev.map((x) =>
                x.id === m.id
                    ? { ...x, currentQty: Math.max(0, x.currentQty + delta) }
                    : x
            )
        );
        startTransition(async () => {
            const res = await adjustMaterialQtyAction(m.id, delta);
            setBusyId(null);
            if (res.error) {
                alert(res.error);
                router.refresh();
            }
        });
    };

    const handleDelete = (m: Material) => {
        if (!confirm(`¿Eliminar el material "${m.name}"? Esta acción no se puede deshacer.`)) {
            return;
        }
        setBusyId(m.id);
        setMaterials((prev) => prev.filter((x) => x.id !== m.id));
        startTransition(async () => {
            const res = await deleteMaterialAction(m.id);
            setBusyId(null);
            if (res.error) {
                alert(res.error);
                router.refresh();
            }
        });
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
                <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <Boxes size={24} className="text-orange-600 dark:text-orange-400" />
                        Inventario de materiales
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Telas, herrajes, hilados y demás insumos usados en producción.
                        Los nombres acá calzan con los insumos que asignás en cada producto.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                    <CollapsibleSearch
                        value={search}
                        onChange={setSearch}
                        placeholder="Buscar por nombre, categoría o proveedor…"
                    />
                    <button
                        type="button"
                        onClick={startCreate}
                        className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md flex items-center gap-2"
                    >
                        <Plus size={16} /> Nuevo material
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="p-2 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-orange-500 outline-none"
                >
                    <option value="all">Todas las categorías ({distinctCategories.length})</option>
                    {distinctCategories.map((c) => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => setShowLowStock((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                        showLowStock
                            ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                    }`}
                >
                    <AlertTriangle size={14} />
                    Bajo stock ({lowStockCount})
                </button>
                <span className="text-xs text-gray-500 dark:text-zinc-500 ml-auto">
                    {filtered.length} de {materials.length}
                </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-x-auto border border-gray-200 dark:border-zinc-800">
                <table className="w-full text-left min-w-[940px]">
                    <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-200 dark:border-zinc-800">
                        <tr>
                            <th className="p-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                                Material
                            </th>
                            <th className="p-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                                Categoría
                            </th>
                            <th className="p-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 text-right">
                                Stock
                            </th>
                            <th className="p-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 text-right">
                                Costo
                            </th>
                            <th className="p-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                                Proveedor
                            </th>
                            <th className="p-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 text-right">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {filtered.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="p-8 text-center text-gray-500 dark:text-zinc-400"
                                >
                                    <Package2 size={32} className="mx-auto mb-2 opacity-30" />
                                    {materials.length === 0
                                        ? 'No hay materiales registrados todavía.'
                                        : 'Ningún material coincide con el filtro.'}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((m) => (
                                <MaterialRow
                                    key={m.id}
                                    material={m}
                                    busy={busyId === m.id}
                                    onEdit={() => startEdit(m)}
                                    onDelete={() => handleDelete(m)}
                                    onAdjust={(delta) => handleAdjust(m, delta)}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {creating && (
                <MaterialFormModal
                    form={form}
                    setForm={setForm}
                    editing={editing}
                    saving={saving}
                    error={error}
                    onClose={() => setCreating(false)}
                    onSubmit={handleSave}
                />
            )}
        </div>
    );
}

function isLowStock(m: Material): boolean {
    if (!m.isActive) return false;
    if (m.minQty <= 0) return false;
    return m.currentQty <= m.minQty;
}

function MaterialRow({
    material,
    busy,
    onEdit,
    onDelete,
    onAdjust
}: {
    material: Material;
    busy: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onAdjust: (delta: number) => void;
}) {
    const low = isLowStock(material);
    const fmt = (n: number) =>
        Number.isInteger(n) ? n.toString() : n.toFixed(2);

    return (
        <tr className={busy ? 'opacity-60' : ''}>
            <td className="p-3">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 dark:text-zinc-100">
                        {material.name}
                    </span>
                    {!material.isActive && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                            Inactivo
                        </span>
                    )}
                </div>
                {material.notes && (
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate max-w-xs mt-0.5">
                        {material.notes}
                    </p>
                )}
            </td>
            <td className="p-3">
                {material.category ? (
                    <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-full">
                        {material.category}
                    </span>
                ) : (
                    <span className="text-xs text-gray-400 dark:text-zinc-600 italic">
                        Sin categoría
                    </span>
                )}
            </td>
            <td className="p-3 text-right">
                <div className="inline-flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onAdjust(-1)}
                        disabled={busy || material.currentQty <= 0}
                        title="Restar 1"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30"
                    >
                        <Minus size={12} />
                    </button>
                    <span
                        className={`min-w-[3.5rem] text-right font-bold tabular-nums ${
                            low
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-900 dark:text-zinc-100'
                        }`}
                        title={
                            material.minQty > 0
                                ? `Mín. ${fmt(material.minQty)} ${material.unit}`
                                : undefined
                        }
                    >
                        {fmt(material.currentQty)}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-zinc-500 min-w-[3.5rem]">
                        {material.unit}
                    </span>
                    <button
                        type="button"
                        onClick={() => onAdjust(1)}
                        disabled={busy}
                        title="Sumar 1"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 disabled:opacity-30"
                    >
                        <Plus size={12} />
                    </button>
                </div>
                {low && (
                    <p className="text-[10px] font-bold text-red-600 dark:text-red-400 mt-1">
                        Bajo mínimo ({fmt(material.minQty)})
                    </p>
                )}
            </td>
            <td className="p-3 text-right">
                {material.unitCost > 0 ? (
                    <span className="text-sm font-semibold text-gray-700 dark:text-zinc-300 tabular-nums">
                        ₡{fmt(material.unitCost)}
                    </span>
                ) : (
                    <span className="text-xs text-gray-400 dark:text-zinc-600">—</span>
                )}
            </td>
            <td className="p-3">
                {material.supplier ? (
                    <span className="text-sm text-gray-700 dark:text-zinc-300">
                        {material.supplier}
                    </span>
                ) : (
                    <span className="text-xs text-gray-400 dark:text-zinc-600">—</span>
                )}
            </td>
            <td className="p-3 text-right">
                <div className="inline-flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onEdit}
                        disabled={busy}
                        title="Editar"
                        className="p-1.5 text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg disabled:opacity-50"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        disabled={busy}
                        title="Eliminar"
                        className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg disabled:opacity-50"
                    >
                        {busy ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Trash2 size={14} />
                        )}
                    </button>
                </div>
            </td>
        </tr>
    );
}

function MaterialFormModal({
    form,
    setForm,
    editing,
    saving,
    error,
    onClose,
    onSubmit
}: {
    form: MaterialInput;
    setForm: (f: MaterialInput) => void;
    editing: Material | null;
    saving: boolean;
    error: string | null;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
}) {
    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {editing ? `Editar ${editing.name}` : 'Nuevo material'}
                    </h3>
                    <button
                        onClick={onClose}
                        type="button"
                        aria-label="Cerrar"
                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="p-5 space-y-3">
                    <Field label="Nombre *">
                        <input
                            required
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-zinc-900"
                            placeholder='ej. "Tela Columbia Azul"'
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Unidad *">
                            <input
                                required
                                type="text"
                                list="material-units"
                                value={form.unit}
                                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-zinc-900"
                            />
                            <datalist id="material-units">
                                {UNIT_SUGGESTIONS.map((u) => (
                                    <option key={u} value={u} />
                                ))}
                            </datalist>
                        </Field>
                        <Field label="Categoría">
                            <input
                                type="text"
                                value={form.category || ''}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                placeholder='ej. "Tela", "Herraje", "Hilados"'
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-zinc-900"
                            />
                        </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <Field label="Stock actual">
                            <input
                                type="number"
                                step="any"
                                min="0"
                                value={form.currentQty ?? 0}
                                onChange={(e) =>
                                    setForm({ ...form, currentQty: parseFloat(e.target.value) || 0 })
                                }
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-zinc-900 tabular-nums"
                            />
                        </Field>
                        <Field label="Mínimo">
                            <input
                                type="number"
                                step="any"
                                min="0"
                                value={form.minQty ?? 0}
                                onChange={(e) =>
                                    setForm({ ...form, minQty: parseFloat(e.target.value) || 0 })
                                }
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-zinc-900 tabular-nums"
                            />
                        </Field>
                        <Field label="Costo unit. (₡)">
                            <input
                                type="number"
                                step="any"
                                min="0"
                                value={form.unitCost ?? 0}
                                onChange={(e) =>
                                    setForm({ ...form, unitCost: parseFloat(e.target.value) || 0 })
                                }
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-zinc-900 tabular-nums"
                            />
                        </Field>
                    </div>
                    <Field label="Proveedor">
                        <input
                            type="text"
                            value={form.supplier || ''}
                            onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-zinc-900"
                        />
                    </Field>
                    <Field label="Notas">
                        <textarea
                            value={form.notes || ''}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            rows={2}
                            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-zinc-900"
                        />
                    </Field>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-zinc-300">
                        <input
                            type="checkbox"
                            checked={form.isActive ?? true}
                            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                            className="w-4 h-4 text-orange-600 dark:text-orange-400 rounded"
                        />
                        Material activo
                    </label>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                        >
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            {editing ? 'Guardar cambios' : 'Crear material'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Field({
    label,
    children
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1">
                {label}
            </span>
            {children}
        </label>
    );
}
