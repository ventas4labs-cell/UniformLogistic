'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
    Box,
    Boxes,
    Inbox,
    Pencil,
    Loader2,
    X,
    Building2,
    Package,
    Check
} from 'lucide-react';
import type {
    ThreeDModel,
    ThreeDProductType,
    ZoneDef,
    DesignRequest,
    DesignStatus
} from '@/lib/services/three-d-models';
import {
    updateModelAction,
    deleteModelAction,
    updateDesignStatusAction,
    acceptDesignRequestAction,
    setCompanyCustomOrderEnabledAction
} from '@/app/(admin)/admin/3d-models/actions';

// R3F is client-only + heavy — load the zone editor lazily so it never
// SSRs and doesn't weigh down the rest of the admin bundle.
const ModelZoneEditor = dynamic(
    () => import('@/components/admin/model-zone-editor').then((m) => m.ModelZoneEditor),
    {
        ssr: false,
        loading: () => (
            <div className="h-80 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm text-gray-400">
                <Loader2 className="animate-spin mr-2" size={16} /> Cargando visor 3D…
            </div>
        )
    }
);

interface Company {
    id: string;
    name: string;
    customOrderEnabled?: boolean;
}

interface ProductOption {
    id: string; // products.id (uuid)
    name: string;
    code: string;
}

const PRODUCT_TYPES: { value: ThreeDProductType; label: string }[] = [
    { value: 'shirt', label: 'Camisa' },
    { value: 'pant', label: 'Pantalón' },
    { value: 'other', label: 'Otro' }
];

const DESIGN_STATUS: { value: DesignStatus; label: string; cls: string }[] = [
    { value: 'sent', label: 'Nueva', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300' },
    { value: 'reviewed', label: 'Revisada', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' },
    { value: 'converted', label: 'Convertida', cls: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300' },
    { value: 'archived', label: 'Archivada', cls: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400' }
];

export function ThreeDModelsManager({
    initialModels,
    companies,
    products,
    initialRequests
}: {
    initialModels: ThreeDModel[];
    companies: Company[];
    products: ProductOption[];
    initialRequests: DesignRequest[];
}) {
    const router = useRouter();
    const [tab, setTab] = useState<'models' | 'requests' | 'companies'>('models');
    const [editing, setEditing] = useState<ThreeDModel | null>(null);

    const newCount = initialRequests.filter((r) => r.status === 'sent').length;

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <Box size={24} className="text-orange-600 dark:text-orange-400" />
                        Modelos 3D
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Los modelos se cargan con{' '}
                        <code className="text-xs bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
                            npm run sync:3d
                        </code>
                        . Definí las zonas de logo, asigná empresas y revisá las solicitudes.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 mb-5">
                <button
                    onClick={() => setTab('models')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                        tab === 'models'
                            ? 'bg-orange-600 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300'
                    }`}
                >
                    <Boxes size={16} /> Modelos ({initialModels.length})
                </button>
                <button
                    onClick={() => setTab('requests')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                        tab === 'requests'
                            ? 'bg-orange-600 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300'
                    }`}
                >
                    <Inbox size={16} /> Solicitudes ({initialRequests.length})
                    {newCount > 0 && (
                        <span className="ml-0.5 bg-red-500 text-white text-[10px] font-bold h-5 min-w-5 px-1 rounded-full flex items-center justify-center">
                            {newCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setTab('companies')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                        tab === 'companies'
                            ? 'bg-orange-600 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300'
                    }`}
                >
                    <Building2 size={16} /> Empresas
                </button>
            </div>

            {tab === 'models' ? (
                initialModels.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400">
                        No hay modelos. Colocá archivos en{' '}
                        <span className="font-semibold">3D MODELS/</span> y corré{' '}
                        <code className="text-xs bg-gray-100 dark:bg-zinc-800 px-1 rounded">npm run sync:3d</code>.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {initialModels.map((m) => (
                            <div
                                key={m.id}
                                className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm p-4 flex flex-col"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-gray-900 dark:text-zinc-100 truncate">
                                            {m.name}
                                        </h3>
                                        <p className="text-xs font-mono text-gray-400 dark:text-zinc-500">
                                            {m.code}
                                        </p>
                                    </div>
                                    {!m.isActive && (
                                        <span className="text-[10px] font-bold uppercase text-gray-400 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                            Inactivo
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-3 flex-wrap text-xs">
                                    <span className="bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 font-bold px-2 py-1 rounded-full">
                                        {m.zones.length} zona{m.zones.length === 1 ? '' : 's'}
                                    </span>
                                    <span className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 font-bold px-2 py-1 rounded-full inline-flex items-center gap-1">
                                        <Building2 size={12} /> {m.companyIds.length}
                                    </span>
                                    {!m.allowLogoPlacement && (
                                        <span className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 font-medium px-2 py-1 rounded-full">
                                            Sin edición de logos
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => setEditing(m)}
                                    className="mt-4 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-100 dark:bg-zinc-800 hover:bg-orange-100 dark:hover:bg-orange-950/40 text-gray-700 dark:text-zinc-200 hover:text-orange-700 dark:hover:text-orange-300 text-sm font-bold transition-colors"
                                >
                                    <Pencil size={14} /> Editar
                                </button>
                            </div>
                        ))}
                    </div>
                )
            ) : tab === 'requests' ? (
                <RequestsList requests={initialRequests} onChanged={() => router.refresh()} />
            ) : (
                <CompaniesToggleList companies={companies} />
            )}

            {editing && (
                <ModelEditModal
                    model={editing}
                    companies={companies}
                    products={products}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        router.refresh();
                    }}
                />
            )}
        </div>
    );
}

// ── Edit modal ──────────────────────────────────────────────────────
function ModelEditModal({
    model,
    companies,
    products,
    onClose,
    onSaved
}: {
    model: ThreeDModel;
    companies: Company[];
    products: ProductOption[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const [name, setName] = useState(model.name);
    const [productType, setProductType] = useState<ThreeDProductType>(model.productType);
    const [allowLogo, setAllowLogo] = useState(model.allowLogoPlacement);
    const [allowCustomLogo, setAllowCustomLogo] = useState(model.allowCustomLogo);
    const [productId, setProductId] = useState<string>(model.productId || '');
    const [isActive, setIsActive] = useState(model.isActive);
    const [zones, setZones] = useState<ZoneDef[]>(model.zones);
    const [assigned, setAssigned] = useState<Set<string>>(new Set(model.companyIds));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleCompany = (id: string) =>
        setAssigned((prev) => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            await updateModelAction(model.id, {
                name: name.trim() || model.code,
                productType,
                allowLogoPlacement: allowLogo,
                allowCustomLogo,
                productId: productId || null,
                isActive,
                zones,
                companyIds: [...assigned]
            });
            onSaved();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo guardar.');
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl my-8">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-zinc-100">
                        Editar modelo
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs font-bold text-gray-600 dark:text-zinc-400">Nombre</span>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="mt-1 w-full p-2 border rounded-lg text-sm bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-gray-600 dark:text-zinc-400">Tipo</span>
                            <select
                                value={productType}
                                onChange={(e) => setProductType(e.target.value as ThreeDProductType)}
                                className="mt-1 w-full p-2 border rounded-lg text-sm bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-orange-500"
                            >
                                {PRODUCT_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className="block">
                        <span className="text-xs font-bold text-gray-600 dark:text-zinc-400">
                            Producto vinculado
                        </span>
                        <select
                            value={productId}
                            onChange={(e) => setProductId(e.target.value)}
                            className="mt-1 w-full p-2 border rounded-lg text-sm bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            <option value="">Sin producto</option>
                            {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({p.code})
                                </option>
                            ))}
                        </select>
                        <span className="text-[11px] text-gray-400 dark:text-zinc-500">
                            Se guarda en la solicitud para crear el pedido fácilmente.
                        </span>
                    </label>

                    <div className="flex flex-wrap gap-4">
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-zinc-300">
                            <input type="checkbox" checked={allowLogo} onChange={(e) => setAllowLogo(e.target.checked)} className="accent-orange-600 w-4 h-4" />
                            Permitir edición de logos
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-zinc-300">
                            <input type="checkbox" checked={allowCustomLogo} onChange={(e) => setAllowCustomLogo(e.target.checked)} className="accent-orange-600 w-4 h-4" />
                            Permitir logo personalizado
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-zinc-300">
                            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-orange-600 w-4 h-4" />
                            Activo
                        </label>
                    </div>

                    {/* Zone editor */}
                    <div>
                        <p className="text-xs font-bold text-gray-600 dark:text-zinc-400 mb-2">
                            Zonas de logo
                        </p>
                        <ModelZoneEditor url={model.modelUrl} zones={zones} onChange={setZones} />
                    </div>

                    {/* Company assignment */}
                    <div>
                        <p className="text-xs font-bold text-gray-600 dark:text-zinc-400 mb-2">
                            Empresas con acceso ({assigned.size})
                        </p>
                        {companies.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No hay empresas.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
                                {companies.map((c) => (
                                    <label
                                        key={c.id}
                                        className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={assigned.has(c.id)}
                                            onChange={() => toggleCompany(c.id)}
                                            className="accent-orange-600 w-4 h-4"
                                        />
                                        <span className="truncate text-gray-700 dark:text-zinc-300">{c.name}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                </div>

                <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 dark:border-zinc-800">
                    <DeleteButton modelId={model.id} onDeleted={onSaved} />
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 font-bold text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800">
                            Cancelar
                        </button>
                        <button
                            onClick={save}
                            disabled={saving}
                            className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                            Guardar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DeleteButton({ modelId, onDeleted }: { modelId: string; onDeleted: () => void }) {
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    if (!confirm) {
        return (
            <button
                onClick={() => setConfirm(true)}
                className="text-sm font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
            >
                Eliminar
            </button>
        );
    }
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-zinc-400">¿Seguro?</span>
            <button
                onClick={async () => {
                    setBusy(true);
                    await deleteModelAction(modelId);
                    onDeleted();
                }}
                disabled={busy}
                className="font-bold text-red-600 hover:text-red-700 inline-flex items-center gap-1"
            >
                {busy && <Loader2 size={13} className="animate-spin" />} Sí, eliminar
            </button>
            <button onClick={() => setConfirm(false)} className="text-gray-500">Cancelar</button>
        </div>
    );
}

// ── Requests tab ────────────────────────────────────────────────────
function RequestsList({
    requests,
    onChanged
}: {
    requests: DesignRequest[];
    onChanged: () => void;
}) {
    if (requests.length === 0) {
        return (
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400">
                No hay solicitudes de diseño todavía.
            </div>
        );
    }
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {requests.map((r) => (
                <RequestCard key={r.id} request={r} onChanged={onChanged} />
            ))}
        </div>
    );
}

function RequestCard({ request: r, onChanged }: { request: DesignRequest; onChanged: () => void }) {
    const [busy, setBusy] = useState<DesignStatus | null>(null);
    const [accepting, setAccepting] = useState(false);
    const [acceptErr, setAcceptErr] = useState<string | null>(null);
    const badge = DESIGN_STATUS.find((s) => s.value === r.status) || DESIGN_STATUS[0];
    const totalPieces = r.items.reduce((s, i) => s + i.quantity, 0);

    const setStatus = async (status: DesignStatus) => {
        setBusy(status);
        try {
            await updateDesignStatusAction(r.id, status);
            onChanged();
        } finally {
            setBusy(null);
        }
    };

    const accept = async () => {
        setAccepting(true);
        setAcceptErr(null);
        const res = await acceptDesignRequestAction(r.id);
        setAccepting(false);
        if (res.error) {
            setAcceptErr(res.error);
            return;
        }
        onChanged();
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="flex">
                <div className="w-32 shrink-0 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                    {r.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.previewUrl} alt={r.requestRef} className="w-full h-full object-cover" />
                    ) : (
                        <Box size={28} className="text-gray-300 dark:text-zinc-600" />
                    )}
                </div>
                <div className="flex-1 min-w-0 p-4">
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">
                            {r.requestRef}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                            {badge.label}
                        </span>
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-zinc-100 truncate mt-0.5">
                        {r.companyName || '—'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                        {r.modelName}{r.colorName ? ` · ${r.colorName}` : ''} ·{' '}
                        {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                    {r.productName && (
                        <p className="text-xs mt-1 inline-flex items-center gap-1 font-semibold text-gray-700 dark:text-zinc-200 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                            <Package size={12} /> {r.productName}
                            {r.productCode ? ` (${r.productCode})` : ''}
                        </p>
                    )}
                    {r.logos.length > 0 && (
                        <ul className="mt-2 space-y-1">
                            {r.logos.map((l) => (
                                <li key={l.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-300">
                                    {l.logoImageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={l.logoImageUrl}
                                            alt={l.logoName}
                                            className="w-7 h-7 rounded object-contain bg-white border border-gray-200 dark:border-zinc-700 shrink-0"
                                        />
                                    ) : (
                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                                    )}
                                    <span className="font-medium">{l.zoneLabel}:</span>
                                    <span className="truncate">{l.logoName || '—'}</span>
                                    {!l.logoId && l.logoImageUrl && (
                                        <span className="text-[9px] font-bold uppercase text-amber-700 bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 px-1 rounded">
                                            Personalizado
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                    {r.items.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {r.items.map((it, i) => (
                                <span
                                    key={i}
                                    className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200"
                                >
                                    {it.size} ×{it.quantity}
                                </span>
                            ))}
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300">
                                {totalPieces} pzas
                            </span>
                        </div>
                    )}
                    {r.notes && (
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 italic line-clamp-2">{r.notes}</p>
                    )}
                    {acceptErr && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">{acceptErr}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {r.status !== 'converted' && (
                            <button
                                onClick={accept}
                                disabled={accepting || r.items.length === 0 || !r.productCode}
                                title={!r.productCode ? 'La solicitud no tiene producto vinculado' : ''}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white inline-flex items-center gap-1.5 disabled:opacity-40"
                            >
                                {accepting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                Aceptar y crear pedido
                            </button>
                        )}
                        {(['reviewed', 'archived'] as DesignStatus[]).map((s) => {
                            const label = DESIGN_STATUS.find((d) => d.value === s)!.label;
                            return (
                                <button
                                    key={s}
                                    onClick={() => setStatus(s)}
                                    disabled={busy !== null || r.status === s}
                                    className="text-[11px] font-bold px-2 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-40"
                                >
                                    {busy === s ? '…' : label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Empresas tab — per-company 3D feature toggle ────────────────────
function CompaniesToggleList({ companies }: { companies: Company[] }) {
    if (companies.length === 0) {
        return (
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-12 text-center text-gray-500 dark:text-zinc-400">
                No hay empresas.
            </div>
        );
    }
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <p className="px-4 py-3 text-sm text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                Activá o desactivá el <span className="font-semibold">pedido 3D personalizado</span> por
                empresa. Al desactivarlo, la empresa deja de ver la opción aunque tenga modelos asignados.
            </p>
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                {companies.map((c) => (
                    <CompanyToggleRow key={c.id} company={c} />
                ))}
            </div>
        </div>
    );
}

function CompanyToggleRow({ company }: { company: Company }) {
    const [enabled, setEnabled] = useState(company.customOrderEnabled !== false);
    const [busy, setBusy] = useState(false);

    const toggle = async () => {
        const next = !enabled;
        setEnabled(next);
        setBusy(true);
        try {
            await setCompanyCustomOrderEnabledAction(company.id, next);
        } catch {
            setEnabled(!next); // revert on failure
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="font-medium text-gray-800 dark:text-zinc-200 truncate">{company.name}</span>
            <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-bold ${enabled ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-zinc-500'}`}>
                    {enabled ? 'Activo' : 'Desactivado'}
                </span>
                <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`Pedido 3D para ${company.name}`}
                    onClick={toggle}
                    disabled={busy}
                    className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-60 ${
                        enabled ? 'bg-orange-600' : 'bg-gray-300 dark:bg-zinc-700'
                    }`}
                >
                    <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            enabled ? 'translate-x-5' : ''
                        }`}
                    />
                </button>
            </div>
        </div>
    );
}
