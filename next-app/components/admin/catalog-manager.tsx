'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    Building2,
    Check,
    Filter,
    ImageIcon,
    Loader2,
    Save,
    Search,
    X
} from 'lucide-react';
import type { Company } from '@/lib/services/companies';
import type { CatalogProductForCompany } from '@/lib/services/companyCatalog';
import { saveCatalogAssignmentsAction } from '@/app/(admin)/admin/catalog/actions';

interface Props {
    companies: Company[];
    initialCatalog: CatalogProductForCompany[];
    selectedCompanyId: string;
}

type TypeFilter = 'all' | 'shirt' | 'pant';

export function CatalogManager({ companies, initialCatalog, selectedCompanyId }: Props) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [catalog, setCatalog] = useState<CatalogProductForCompany[]>(initialCatalog);
    const [original] = useState(() => {
        const m = new Map<string, boolean>();
        initialCatalog.forEach((p) => m.set(p.uuid, p.isAssigned));
        return m;
    });
    const [error, setError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Filters
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [onlyAssigned, setOnlyAssigned] = useState(false);

    const changeCompany = (id: string) => {
        router.push(`/admin/catalog?company=${id}`);
    };

    const toggle = (uuid: string) => {
        setSaveSuccess(false);
        setCatalog((prev) =>
            prev.map((p) => (p.uuid === uuid ? { ...p, isAssigned: !p.isAssigned } : p))
        );
    };

    const setBulk = (predicate: (p: CatalogProductForCompany) => boolean, value: boolean) => {
        setSaveSuccess(false);
        setCatalog((prev) =>
            prev.map((p) => (predicate(p) ? { ...p, isAssigned: value } : p))
        );
    };

    const pendingChanges = useMemo(
        () =>
            catalog.filter((p) => {
                const o = original.get(p.uuid);
                return o !== undefined && o !== p.isAssigned;
            }),
        [catalog, original]
    );
    const hasChanges = pendingChanges.length > 0;

    const handleSave = () => {
        if (!selectedCompanyId || !hasChanges) return;
        setError(null);
        setSaveSuccess(false);
        startTransition(async () => {
            try {
                await saveCatalogAssignmentsAction(
                    selectedCompanyId,
                    pendingChanges.map((p) => ({ productUuid: p.uuid, assigned: p.isAssigned }))
                );
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
                router.refresh();
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Error guardando cambios');
            }
        });
    };

    // Derived stats
    const assignedShirts = catalog.filter((p) => p.isAssigned && p.type === 'shirt').length;
    const assignedPants = catalog.filter((p) => p.isAssigned && p.type === 'pant').length;
    const totalAssigned = assignedShirts + assignedPants;
    const missingCabysAssigned = catalog.filter((p) => p.isAssigned && !p.codigoCabys).length;

    // Visible rows (after search/filter)
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return catalog.filter((p) => {
            if (typeFilter !== 'all' && p.type !== typeFilter) return false;
            if (onlyAssigned && !p.isAssigned) return false;
            if (!q) return true;
            return (
                p.name.toLowerCase().includes(q) ||
                p.id.toLowerCase().includes(q) ||
                (p.fabricType || '').toLowerCase().includes(q)
            );
        });
    }, [catalog, query, typeFilter, onlyAssigned]);

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Catálogo por Empresa</h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Selecciona los productos que cada empresa puede pedir.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <button
                            type="button"
                            onClick={() => setCatalog(initialCatalog)}
                            className="px-4 py-2.5 rounded-lg font-semibold text-sm border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                        >
                            Descartar
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || pending}
                        className={`px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all ${
                            hasChanges
                                ? 'bg-orange-600 text-white hover:bg-orange-700'
                                : 'bg-gray-200 dark:bg-zinc-700 text-gray-400 dark:text-zinc-500 cursor-not-allowed'
                        }`}
                    >
                        {pending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        {pending ? 'Guardando...' : `Guardar${hasChanges ? ` (${pendingChanges.length})` : ''}`}
                    </button>
                </div>
            </div>

            {saveSuccess && (
                <div className="mb-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/60 text-green-800 dark:text-green-300 p-3 rounded-lg text-sm flex items-center gap-2">
                    <Check size={18} /> Catálogo guardado exitosamente.
                </div>
            )}

            {companies.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-10 text-center text-gray-500 dark:text-zinc-400 shadow-sm">
                    <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                    Crea una empresa primero en la pestaña &ldquo;Empresas&rdquo;.
                </div>
            ) : (
                <>
                    {/* Company picker + summary card */}
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm mb-4 grid grid-cols-1 lg:grid-cols-[1.2fr,2fr] gap-4 items-end">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                                Empresa
                            </label>
                            <select
                                value={selectedCompanyId}
                                onChange={(e) => changeCompany(e.target.value)}
                                className="w-full p-3 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-semibold"
                            >
                                {companies.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <Stat label="Asignados" value={totalAssigned} accent="orange" />
                            <Stat
                                label="Camisas"
                                value={assignedShirts}
                                sub={`de ${catalog.filter((p) => p.type === 'shirt').length}`}
                                accent="blue"
                            />
                            <Stat
                                label="Pantalones"
                                value={assignedPants}
                                sub={`de ${catalog.filter((p) => p.type === 'pant').length}`}
                                accent="purple"
                            />
                        </div>
                    </div>

                    {missingCabysAssigned > 0 && (
                        <div className="mb-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 p-3 rounded-lg text-sm flex items-start gap-2">
                            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                            <div>
                                <strong>{missingCabysAssigned}</strong> producto
                                {missingCabysAssigned === 1 ? '' : 's'} asignado
                                {missingCabysAssigned === 1 ? '' : 's'} a esta empresa{' '}
                                {missingCabysAssigned === 1 ? 'no tiene' : 'no tienen'} código
                                CABYS. Las facturas pueden fallar — configúralos en la pestaña
                                &ldquo;Productos&rdquo;.
                            </div>
                        </div>
                    )}

                    {/* Toolbar: search + filters */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-3 mb-4 flex flex-col sm:flex-row gap-2 sm:items-center">
                        <div className="relative flex-1">
                            <Search
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
                            />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Buscar por nombre, código o tela…"
                                className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div className="flex gap-1">
                            {(['all', 'shirt', 'pant'] as TypeFilter[]).map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setTypeFilter(f)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                                        typeFilter === f
                                            ? 'bg-orange-600 text-white'
                                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                    }`}
                                >
                                    {f === 'all' ? 'Todos' : f === 'shirt' ? 'Camisas' : 'Pantalones'}
                                </button>
                            ))}
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300 px-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={onlyAssigned}
                                onChange={(e) => setOnlyAssigned(e.target.checked)}
                                className="w-4 h-4 accent-orange-600"
                            />
                            <Filter size={14} /> Solo asignados
                        </label>
                    </div>

                    {/* Bulk actions */}
                    <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                        <span className="text-gray-500 dark:text-zinc-400 font-semibold">Acciones rápidas:</span>
                        <BulkBtn
                            onClick={() =>
                                setBulk(
                                    (p) =>
                                        (typeFilter === 'all' || p.type === typeFilter) &&
                                        (!query ||
                                            p.name.toLowerCase().includes(query.toLowerCase()) ||
                                            p.id.toLowerCase().includes(query.toLowerCase())),
                                    true
                                )
                            }
                        >
                            Asignar visibles
                        </BulkBtn>
                        <BulkBtn
                            onClick={() =>
                                setBulk(
                                    (p) =>
                                        (typeFilter === 'all' || p.type === typeFilter) &&
                                        (!query ||
                                            p.name.toLowerCase().includes(query.toLowerCase()) ||
                                            p.id.toLowerCase().includes(query.toLowerCase())),
                                    false
                                )
                            }
                        >
                            Desasignar visibles
                        </BulkBtn>
                        <BulkBtn onClick={() => setBulk((p) => p.type === 'shirt', true)}>
                            Asignar todas las camisas
                        </BulkBtn>
                        <BulkBtn onClick={() => setBulk((p) => p.type === 'pant', true)}>
                            Asignar todos los pantalones
                        </BulkBtn>
                        <BulkBtn onClick={() => setBulk(() => true, false)} danger>
                            Desasignar todo
                        </BulkBtn>
                        <span className="ml-auto text-gray-500 dark:text-zinc-400">
                            Mostrando {visible.length} de {catalog.length}
                        </span>
                    </div>

                    {/* Table */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-200 dark:border-zinc-800">
                                <tr>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-zinc-400 w-14 text-center">Asig.</th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-zinc-400 w-14"></th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-zinc-400">Producto</th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-zinc-400">Tipo</th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-zinc-400">Género</th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-zinc-400">Tela</th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-zinc-400">CABYS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {visible.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-10 text-center text-gray-400 dark:text-zinc-500">
                                            Sin productos que coincidan con los filtros.
                                        </td>
                                    </tr>
                                ) : (
                                    visible.map((p) => {
                                        const changed = original.get(p.uuid) !== p.isAssigned;
                                        return (
                                            <tr
                                                key={p.uuid}
                                                className={`hover:bg-gray-50 dark:hover:bg-zinc-800/70 cursor-pointer transition-colors ${p.isAssigned ? 'bg-orange-50/50 dark:bg-orange-950/30' : ''} ${changed ? 'ring-1 ring-inset ring-orange-300 dark:ring-orange-500/60' : ''}`}
                                                onClick={() => toggle(p.uuid)}
                                            >
                                                <td className="p-3 text-center">
                                                    {p.isAssigned ? (
                                                        <span className="inline-flex items-center justify-center w-7 h-7 bg-orange-600 text-white rounded-md">
                                                            <Check size={16} />
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center justify-center w-7 h-7 border-2 border-gray-200 dark:border-zinc-800 rounded-md text-gray-300 dark:text-zinc-600">
                                                            <X size={14} />
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    {p.image ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={p.image}
                                                            alt=""
                                                            className="w-10 h-10 object-cover rounded-md border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-md border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 flex items-center justify-center text-gray-300 dark:text-zinc-600">
                                                            <ImageIcon size={16} />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-gray-900 dark:text-zinc-100">{p.name}</div>
                                                    <div className="text-xs font-mono text-gray-400 dark:text-zinc-500">
                                                        {p.id}
                                                    </div>
                                                    {changed && (
                                                        <div className="text-xs text-orange-500 font-semibold mt-0.5">
                                                            • modificado
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <span
                                                        className={`text-xs font-bold px-2 py-1 rounded-full ${
                                                            p.type === 'shirt'
                                                                ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 dark:bg-blue-950/50 dark:text-blue-300'
                                                                : 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 dark:bg-purple-950/50 dark:text-purple-300'
                                                        }`}
                                                    >
                                                        {p.type === 'shirt' ? 'Camisa' : 'Pantalón'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-gray-600 dark:text-zinc-400 text-sm">{p.category}</td>
                                                <td className="p-3 text-gray-600 dark:text-zinc-400 text-sm">
                                                    {p.fabricType || '—'}
                                                </td>
                                                <td className="p-3">
                                                    {p.codigoCabys ? (
                                                        <span className="text-xs font-mono text-gray-700 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                                                            {p.codigoCabys}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:bg-amber-950/40 px-2 py-0.5 rounded font-semibold inline-flex items-center gap-1">
                                                            <AlertTriangle size={11} />
                                                            Sin CABYS
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {error && (
                <div className="mt-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/50">
                    {error}
                </div>
            )}
        </div>
    );
}

// ── Subcomponents ───────────────────────────────────────────────────────

function Stat({
    label,
    value,
    sub,
    accent
}: {
    label: string;
    value: number;
    sub?: string;
    accent: 'orange' | 'blue' | 'purple';
}) {
    const cls =
        accent === 'orange'
            ? 'text-orange-600 dark:text-orange-400'
            : accent === 'blue'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-purple-600 dark:text-purple-400';
    return (
        <div className="bg-gray-50 dark:bg-zinc-900/60 rounded-lg p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-zinc-400 font-semibold">
                {label}
            </div>
            <div className={`text-2xl font-bold ${cls} leading-none mt-1`}>{value}</div>
            {sub && <div className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">{sub}</div>}
        </div>
    );
}

function BulkBtn({
    onClick,
    children,
    danger
}: {
    onClick: () => void;
    children: React.ReactNode;
    danger?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                danger
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-100 dark:border-red-900/50'
                    : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 border border-gray-200 dark:border-zinc-800'
            }`}
        >
            {children}
        </button>
    );
}
