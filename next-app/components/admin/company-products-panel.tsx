'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Check,
    ImageIcon,
    Loader2,
    Package,
    Plus,
    Search,
    X
} from 'lucide-react';
import { setCompanyProductAssignmentAction } from '@/app/(admin)/admin/companies/[id]/actions';

interface PanelProduct {
    uuid: string;
    id: string;
    name: string;
    typeLabel: string;
    image: string;
    category: string;
    fabricType: string;
    isAssigned: boolean;
    isActive: boolean;
}

interface Props {
    companyId: string;
    initialProducts: PanelProduct[];
}

// Two views on the same data:
// 1. Default view shows what's currently assigned to the empresa as a
//    compact card grid, with a "Asignar productos" button to open the
//    full picker.
// 2. The picker modal lists every product (assigned and not) with a
//    one-click toggle per row. Filtering by search keeps long catalogs
//    scannable.
export function CompanyProductsPanel({ companyId, initialProducts }: Props) {
    const router = useRouter();
    const [products, setProducts] = useState<PanelProduct[]>(initialProducts);
    const [pickerOpen, setPickerOpen] = useState(false);

    const assigned = useMemo(
        () => products.filter((p) => p.isAssigned),
        [products]
    );

    const handleToggle = (uuid: string, next: boolean) => {
        // Optimistic: flip locally first, then send the action.
        setProducts((prev) =>
            prev.map((p) => (p.uuid === uuid ? { ...p, isAssigned: next } : p))
        );
        // Fire and forget via the form action; if it fails the user
        // sees a refresh-recover via router.refresh in catch.
        (async () => {
            const res = await setCompanyProductAssignmentAction(
                companyId,
                uuid,
                next
            );
            if (res.error) {
                setProducts((prev) =>
                    prev.map((p) =>
                        p.uuid === uuid ? { ...p, isAssigned: !next } : p
                    )
                );
                alert(res.error);
                router.refresh();
            }
        })();
    };

    return (
        <section>
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Package size={18} className="text-orange-600 dark:text-orange-400" />
                    Productos asignados
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">
                        {assigned.length}
                    </span>
                </h2>
                <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-950/60"
                >
                    <Plus size={14} strokeWidth={3} /> Asignar productos
                </button>
            </div>

            {assigned.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-6 text-center text-sm text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-800">
                    Sin productos asignados. Tocá{' '}
                    <span className="font-semibold">&ldquo;Asignar productos&rdquo;</span>{' '}
                    para seleccionarlos del catálogo maestro.
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {assigned.map((p) => (
                        <AssignedCard
                            key={p.uuid}
                            product={p}
                            onUnassign={() => handleToggle(p.uuid, false)}
                        />
                    ))}
                </div>
            )}

            {pickerOpen && (
                <PickerModal
                    products={products}
                    onToggle={handleToggle}
                    onClose={() => setPickerOpen(false)}
                />
            )}
        </section>
    );
}

function AssignedCard({
    product,
    onUnassign
}: {
    product: PanelProduct;
    onUnassign: () => void;
}) {
    return (
        <div
            className={`relative bg-white dark:bg-zinc-900 rounded-xl shadow-sm border ${
                product.isActive
                    ? 'border-gray-200 dark:border-zinc-800'
                    : 'border-amber-200 dark:border-amber-900/50 opacity-70'
            } overflow-hidden flex items-center gap-3 p-2.5 group`}
        >
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                {product.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <ImageIcon size={16} className="text-gray-400 dark:text-zinc-500" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">
                    {product.name}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate">
                    {product.typeLabel} · {product.id}
                </p>
            </div>
            <button
                type="button"
                onClick={onUnassign}
                title="Quitar del catálogo de la empresa"
                aria-label="Quitar del catálogo de la empresa"
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
                <X size={14} />
            </button>
        </div>
    );
}

function PickerModal({
    products,
    onToggle,
    onClose
}: {
    products: PanelProduct[];
    onToggle: (uuid: string, next: boolean) => void;
    onClose: () => void;
}) {
    const [query, setQuery] = useState('');
    const [onlyAssigned, setOnlyAssigned] = useState(false);
    const [pending, startTransition] = useTransition();

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return products.filter((p) => {
            if (!p.isActive) return false;
            if (onlyAssigned && !p.isAssigned) return false;
            if (!q) return true;
            return (
                p.name.toLowerCase().includes(q) ||
                p.id.toLowerCase().includes(q) ||
                p.typeLabel.toLowerCase().includes(q)
            );
        });
    }, [products, query, onlyAssigned]);

    const assignedCount = products.filter((p) => p.isAssigned).length;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <Package size={18} className="text-orange-600 dark:text-orange-400" />
                            Asignar productos
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                            {assignedCount} asignado{assignedCount === 1 ? '' : 's'} de{' '}
                            {products.filter((p) => p.isActive).length} productos activos
                            en el catálogo maestro.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 border-b border-gray-100 dark:border-zinc-800 space-y-2">
                    <div className="relative">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
                        />
                        <input
                            type="search"
                            autoFocus
                            placeholder="Buscar por nombre, código o tipo…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-400">
                        <input
                            type="checkbox"
                            checked={onlyAssigned}
                            onChange={(e) => setOnlyAssigned(e.target.checked)}
                            className="w-4 h-4 text-orange-600 dark:text-orange-400 rounded"
                        />
                        Mostrar solo los asignados
                    </label>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                    {filtered.length === 0 ? (
                        <p className="text-center text-sm text-gray-500 dark:text-zinc-500 italic py-10">
                            Ningún producto coincide con el filtro.
                        </p>
                    ) : (
                        filtered.map((p) => (
                            <PickerRow
                                key={p.uuid}
                                product={p}
                                onToggle={(next) =>
                                    startTransition(() => onToggle(p.uuid, next))
                                }
                                disabled={pending}
                            />
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-zinc-800 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 text-sm"
                    >
                        Listo
                    </button>
                </div>
            </div>
        </div>
    );
}

function PickerRow({
    product,
    onToggle,
    disabled
}: {
    product: PanelProduct;
    onToggle: (next: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={() => onToggle(!product.isAssigned)}
            disabled={disabled}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors disabled:opacity-50 ${
                product.isAssigned
                    ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/50 hover:bg-orange-100 dark:hover:bg-orange-950/50'
                    : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
            }`}
        >
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                {product.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <ImageIcon size={16} className="text-gray-400 dark:text-zinc-500" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">
                    {product.name}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate">
                    {product.typeLabel} · {product.id} · {product.category}
                </p>
            </div>
            <span
                className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-md border-2 ${
                    product.isAssigned
                        ? 'bg-orange-600 border-orange-600 text-white'
                        : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-600'
                }`}
            >
                {product.isAssigned && (
                    <Check size={14} strokeWidth={3} />
                )}
            </span>
            {disabled && (
                <Loader2 size={14} className="animate-spin text-gray-400 ml-1" />
            )}
        </button>
    );
}
