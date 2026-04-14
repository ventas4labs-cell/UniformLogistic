'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, X, Building2, Save } from 'lucide-react';
import type { Company } from '@/lib/services/companies';
import type { CatalogProductForCompany } from '@/lib/services/companyCatalog';
import { saveCatalogAssignmentsAction } from '@/app/(admin)/admin/catalog/actions';

interface Props {
    companies: Company[];
    initialCatalog: CatalogProductForCompany[];
    selectedCompanyId: string;
}

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

    const changeCompany = (id: string) => {
        router.push(`/admin/catalog?company=${id}`);
    };

    const toggle = (uuid: string) => {
        setSaveSuccess(false);
        setCatalog((prev) =>
            prev.map((p) => (p.uuid === uuid ? { ...p, isAssigned: !p.isAssigned } : p))
        );
    };

    const pendingChanges = catalog.filter((p) => {
        const o = original.get(p.uuid);
        return o !== undefined && o !== p.isAssigned;
    });
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

    const assignedCount = catalog.filter((p) => p.isAssigned).length;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Catálogo por Empresa</h2>
                    <p className="text-gray-500 text-sm">
                        Selecciona los productos que cada empresa puede pedir.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={!hasChanges || pending}
                    className={`px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all ${
                        hasChanges
                            ? 'bg-orange-600 text-white hover:bg-orange-700'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                    {pending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {pending ? 'Guardando...' : `Guardar${hasChanges ? ` (${pendingChanges.length})` : ''}`}
                </button>
            </div>

            {saveSuccess && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg text-sm flex items-center gap-2">
                    <Check size={18} /> Catálogo guardado exitosamente.
                </div>
            )}

            {companies.length === 0 ? (
                <div className="bg-white rounded-xl p-10 text-center text-gray-500 shadow-sm">
                    <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                    Crea una empresa primero en la pestaña &ldquo;Empresas&rdquo;.
                </div>
            ) : (
                <>
                    <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Empresa</label>
                            <select
                                value={selectedCompanyId}
                                onChange={(e) => changeCompany(e.target.value)}
                                className="w-full max-w-md p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            >
                                {companies.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Productos asignados</p>
                            <p className="text-2xl font-bold text-orange-600">
                                {assignedCount}{' '}
                                <span className="text-sm text-gray-400 font-normal">/ {catalog.length}</span>
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="p-4 font-semibold text-gray-600 w-16 text-center">Asig.</th>
                                    <th className="p-4 font-semibold text-gray-600">Producto</th>
                                    <th className="p-4 font-semibold text-gray-600">Tipo</th>
                                    <th className="p-4 font-semibold text-gray-600">Género</th>
                                    <th className="p-4 font-semibold text-gray-600">Tela</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {catalog.map((p) => {
                                    const changed = original.get(p.uuid) !== p.isAssigned;
                                    return (
                                        <tr
                                            key={p.uuid}
                                            className={`hover:bg-gray-50 cursor-pointer ${p.isAssigned ? 'bg-orange-50/40' : ''} ${changed ? 'ring-1 ring-inset ring-orange-300' : ''}`}
                                            onClick={() => toggle(p.uuid)}
                                        >
                                            <td className="p-4 text-center">
                                                {p.isAssigned ? (
                                                    <span className="inline-flex items-center justify-center w-7 h-7 bg-orange-600 text-white rounded-md">
                                                        <Check size={16} />
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center justify-center w-7 h-7 border-2 border-gray-200 rounded-md text-gray-300">
                                                        <X size={14} />
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 font-bold text-gray-900">
                                                {p.name}
                                                {changed && (
                                                    <span className="ml-2 text-xs text-orange-500 font-normal">
                                                        • modificado
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span
                                                    className={`text-xs font-bold px-2 py-1 rounded-full ${p.type === 'shirt' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}
                                                >
                                                    {p.type === 'shirt' ? 'Camisa' : 'Pantalón'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-gray-600 text-sm">{p.category}</td>
                                            <td className="p-4 text-gray-600 text-sm">{p.fabricType || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {error && (
                <div className="mt-4 bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-100">{error}</div>
            )}
        </div>
    );
}
