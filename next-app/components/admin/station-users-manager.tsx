'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Check,
    Copy,
    HardHat,
    Link2,
    Loader2,
    Plus,
    Power,
    PowerOff,
    RefreshCcw,
    Trash2,
    X
} from 'lucide-react';
import type { StationUser } from '@/lib/services/station-users';
import { STAGE_LABELS, STAGE_ORDER, type StageKey } from '@/lib/services/stage-completions';
import {
    assignStationToOrderAction,
    createStationUserAction,
    deleteStationUserAction,
    regenerateStationAccessTokenAction,
    setStationUserActiveAction
} from '@/app/(admin)/admin/station-users/actions';

// Build the full share URL the station bookmarks. Safe to call in
// event handlers (copy/regenerate) — they only run client-side. For
// RENDER-time use (e.g. a title attribute) prefer buildStationUrlWith
// + the mounted-origin state so the server and first client render
// agree and we don't trip a hydration mismatch.
function buildStationUrl(token: string): string {
    if (typeof window === 'undefined') return `/s/${token}`;
    return `${window.location.origin}/s/${token}`;
}

// origin === '' on the server and on the first client render, so both
// produce `/s/<token>`; after mount the effect fills origin in and the
// title upgrades to the absolute URL without a mismatch.
function buildStationUrlWith(origin: string, token: string): string {
    return origin ? `${origin}/s/${token}` : `/s/${token}`;
}

export interface OrderSummary {
    uuid: string;
    ref: string;
    companyName: string;
    createdAt: string;
    deliveryDate: string;
}

interface ManagerProps {
    initialUsers: StationUser[];
    orderSummaries: OrderSummary[];
    initialAssignments: { orderId: string; stationUserId: string }[];
    // Embedded mode renders ONLY the create modal so a new station can be
    // created as a popup from the fast actions, without the list/assign UI.
    embedded?: boolean;
    onClose?: () => void;
}

export function StationUsersManager({
    initialUsers,
    orderSummaries,
    initialAssignments,
    embedded = false,
    onClose
}: ManagerProps) {
    const router = useRouter();
    const [users, setUsers] = useState<StationUser[]>(initialUsers);
    const [creating, setCreating] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [pending, startTransition] = useTransition();
    // Empty on server + first client render; filled after mount so the
    // hover title can show the absolute URL without a hydration
    // mismatch on the `title` attribute.
    const [origin, setOrigin] = useState('');
    useEffect(() => setOrigin(window.location.origin), []);
    // Tracks current order↔station pairings so the assign modal can
    // grey out pairs that already exist (avoids the round-trip + the
    // duplicate-PK error if admin tries to re-assign).
    const [assignmentPairs, setAssignmentPairs] = useState<Set<string>>(
        () => new Set(initialAssignments.map((a) => `${a.orderId}|${a.stationUserId}`))
    );

    const registerLocalAssignment = (orderId: string, stationUserId: string) => {
        setAssignmentPairs((prev) => {
            const next = new Set(prev);
            next.add(`${orderId}|${stationUserId}`);
            return next;
        });
    };

    const handleCreated = (u: StationUser) => {
        setUsers((prev) => [...prev, u].sort((a, b) => a.displayName.localeCompare(b.displayName)));
        setCreating(false);
        router.refresh();
    };

    const handleSetActive = (userId: string, isActive: boolean) => {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive } : u)));
        startTransition(async () => {
            const res = await setStationUserActiveAction(userId, isActive);
            if (res.error) {
                alert(res.error);
                router.refresh();
            }
        });
    };

    const handleDelete = (u: StationUser) => {
        if (!confirm(`Eliminar la estación "${u.displayName}" (${u.email})? Esta acción no se puede deshacer.`)) {
            return;
        }
        setUsers((prev) => prev.filter((x) => x.id !== u.id));
        startTransition(async () => {
            const res = await deleteStationUserAction(u.id);
            if (res.error) {
                alert(res.error);
                router.refresh();
            }
        });
    };

    // Copy-link UX: when admin taps Copy, flash a check on that row's
    // button for 1.5s. Tracked by station id so multiple rows behave
    // independently.
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const handleCopy = async (u: StationUser) => {
        const url = buildStationUrl(u.accessToken);
        try {
            await navigator.clipboard.writeText(url);
            setCopiedId(u.id);
            setTimeout(() => {
                setCopiedId((prev) => (prev === u.id ? null : prev));
            }, 1500);
        } catch {
            // Fallback for browsers that don't grant clipboard access.
            prompt('Copia el link:', url);
        }
    };

    const handleRegenerate = (u: StationUser) => {
        if (
            !confirm(
                `Generar un link nuevo para "${u.displayName}"? El link viejo dejará de funcionar de inmediato — asegurate de compartir el nuevo con la estación.`
            )
        ) {
            return;
        }
        startTransition(async () => {
            const res = await regenerateStationAccessTokenAction(u.id);
            if (res.error) {
                alert(res.error);
                return;
            }
            if (res.accessToken) {
                setUsers((prev) =>
                    prev.map((x) =>
                        x.id === u.id ? { ...x, accessToken: res.accessToken! } : x
                    )
                );
                // Auto-copy the new token so admin can paste it straight
                // into wherever they share station credentials.
                try {
                    await navigator.clipboard.writeText(buildStationUrl(res.accessToken));
                    setCopiedId(u.id);
                    setTimeout(() => {
                        setCopiedId((prev) => (prev === u.id ? null : prev));
                    }, 1500);
                } catch {
                    /* clipboard unavailable — admin can copy via the button */
                }
            }
        });
    };

    // Embedded popup: just the create modal, no list / assign / header.
    if (embedded) {
        return (
            <CreateModal
                onClose={() => onClose?.()}
                onCreated={() => {
                    router.refresh();
                    onClose?.();
                }}
            />
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <HardHat size={24} className="text-orange-600 dark:text-orange-400" />
                        Estaciones externas
                    </h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Usuarios de maquila, corte, bordado, etc. que solo ven los pedidos asignados.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setAssigning(true)}
                        disabled={users.filter((u) => u.isActive).length === 0}
                        className="bg-white dark:bg-zinc-900 border border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 px-4 py-2 rounded-lg font-bold hover:bg-orange-50 dark:hover:bg-orange-950/40 shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={
                            users.filter((u) => u.isActive).length === 0
                                ? 'Crea primero una estación activa.'
                                : 'Asignar un pedido a una estación externa'
                        }
                    >
                        <Link2 size={16} /> Asignar a estación externa
                    </button>
                    <button
                        type="button"
                        onClick={() => setCreating(true)}
                        className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md flex items-center gap-2"
                    >
                        <Plus size={16} /> Nueva estación
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-x-auto border border-gray-200 dark:border-zinc-800">
                {users.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 dark:text-zinc-400">
                        Aún no hay estaciones registradas.
                    </div>
                ) : (
                    <table className="w-full text-sm min-w-[800px]">
                        <thead className="bg-gray-50 dark:bg-zinc-900/60">
                            <tr>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Nombre</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Etapa</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Link de acceso</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Estado</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-zinc-400 text-xs uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {users.map((u) => (
                                <tr key={u.id} className={u.isActive ? '' : 'opacity-50'}>
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-gray-900 dark:text-zinc-100">
                                            {u.displayName}
                                        </div>
                                        <div className="text-[11px] text-gray-500 dark:text-zinc-500 font-mono">
                                            {u.email}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-xs font-bold">
                                            {STAGE_LABELS[u.stage] || u.stage}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden text-xs font-mono">
                                            <code
                                                className="px-2 py-1.5 text-gray-700 dark:text-zinc-300 truncate max-w-[180px]"
                                                title={buildStationUrlWith(origin, u.accessToken)}
                                            >
                                                /s/{u.accessToken.slice(0, 10)}…
                                            </code>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(u)}
                                                disabled={pending}
                                                title="Copiar link completo"
                                                className={`px-2 py-1.5 border-l border-gray-200 dark:border-zinc-700 transition-colors ${
                                                    copiedId === u.id
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : 'text-gray-500 hover:text-orange-600 dark:hover:text-orange-400'
                                                }`}
                                            >
                                                {copiedId === u.id ? <Check size={12} /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`text-xs font-bold ${
                                                u.isActive ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-zinc-500'
                                            }`}
                                        >
                                            {u.isActive ? 'Activa' : 'Inactiva'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => handleRegenerate(u)}
                                                disabled={pending}
                                                title="Generar link nuevo (invalida el anterior)"
                                                className="p-1.5 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg"
                                            >
                                                <RefreshCcw size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleSetActive(u.id, !u.isActive)}
                                                disabled={pending}
                                                title={u.isActive ? 'Desactivar' : 'Activar'}
                                                className="p-1.5 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg"
                                            >
                                                {u.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(u)}
                                                disabled={pending}
                                                title="Eliminar"
                                                className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {creating && (
                <CreateModal
                    onClose={() => setCreating(false)}
                    onCreated={handleCreated}
                />
            )}

            {assigning && (
                <AssignModal
                    stations={users.filter((u) => u.isActive)}
                    orderSummaries={orderSummaries}
                    assignmentPairs={assignmentPairs}
                    onClose={() => setAssigning(false)}
                    onAssigned={(orderId, stationUserId) => {
                        registerLocalAssignment(orderId, stationUserId);
                        router.refresh();
                    }}
                />
            )}
        </div>
    );
}

function AssignModal({
    stations,
    orderSummaries,
    assignmentPairs,
    onClose,
    onAssigned
}: {
    stations: StationUser[];
    orderSummaries: OrderSummary[];
    assignmentPairs: Set<string>;
    onClose: () => void;
    onAssigned: (orderId: string, stationUserId: string) => void;
}) {
    const [stationUserId, setStationUserId] = useState<string>(stations[0]?.id || '');
    const [orderId, setOrderId] = useState<string>('');
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Filter the order list by the search term plus an "already
    // assigned to this station?" hint so admin can't accidentally
    // re-pick. We don't remove already-assigned rows from the dropdown
    // entirely — admin may want to confirm they're already linked.
    const filteredOrders = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return orderSummaries;
        return orderSummaries.filter(
            (o) =>
                o.ref.toLowerCase().includes(q) ||
                o.companyName.toLowerCase().includes(q)
        );
    }, [orderSummaries, search]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!stationUserId) {
            setError('Selecciona la estación.');
            return;
        }
        if (!orderId) {
            setError('Selecciona el pedido.');
            return;
        }
        if (assignmentPairs.has(`${orderId}|${stationUserId}`)) {
            setError('Esta estación ya tiene asignado este pedido.');
            return;
        }
        setSaving(true);
        const res = await assignStationToOrderAction(orderId, stationUserId);
        setSaving(false);
        if (res.error) {
            setError(res.error);
            return;
        }
        onAssigned(orderId, stationUserId);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <Link2 size={18} className="text-orange-600 dark:text-orange-400" />
                            Asignar pedido a estación externa
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                            La estación verá el pedido la próxima vez que
                            inicie sesión.
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

                <form onSubmit={submit} className="p-5 space-y-4">
                    <Field label="Estación">
                        <select
                            value={stationUserId}
                            onChange={(e) => setStationUserId(e.target.value)}
                            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-zinc-900"
                            required
                        >
                            {stations.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.displayName} · {STAGE_LABELS[s.stage] || s.stage}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Pedido">
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por código de orden o empresa…"
                            className="w-full mb-2 p-2 border rounded-lg text-sm bg-transparent focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                        <select
                            value={orderId}
                            onChange={(e) => setOrderId(e.target.value)}
                            size={Math.min(8, Math.max(4, filteredOrders.length))}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-zinc-900 text-sm"
                            required
                        >
                            {filteredOrders.length === 0 ? (
                                <option value="" disabled>
                                    Sin pedidos que coincidan
                                </option>
                            ) : (
                                filteredOrders.map((o) => {
                                    const alreadyAssigned =
                                        stationUserId &&
                                        assignmentPairs.has(`${o.uuid}|${stationUserId}`);
                                    return (
                                        <option
                                            key={o.uuid}
                                            value={o.uuid}
                                            disabled={!!alreadyAssigned}
                                        >
                                            {o.ref} — {o.companyName}
                                            {o.deliveryDate
                                                ? ` · Entrega ${new Date(o.deliveryDate).toLocaleDateString()}`
                                                : ''}
                                            {alreadyAssigned ? ' · ya asignado' : ''}
                                        </option>
                                    );
                                })
                            )}
                        </select>
                    </Field>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            Asignar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function CreateModal({
    onClose,
    onCreated
}: {
    onClose: () => void;
    onCreated: (u: StationUser) => void;
}) {
    const [email, setEmail] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [stage, setStage] = useState<StageKey>('corte');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    // Two-step modal — form first; on success we show the share URL
    // so admin can copy it before closing.
    const [createdShare, setCreatedShare] = useState<{
        user: StationUser;
        url: string;
    } | null>(null);
    const [copied, setCopied] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        const res = await createStationUserAction({ email, displayName, stage });
        setSaving(false);
        if (res.error) {
            setError(res.error);
            return;
        }
        if (res.userId && res.accessToken) {
            const user: StationUser = {
                id: res.userId,
                email: email.trim().toLowerCase(),
                displayName: displayName.trim(),
                stage,
                isActive: true,
                createdAt: new Date().toISOString(),
                accessToken: res.accessToken
            };
            onCreated(user);
            setCreatedShare({ user, url: buildStationUrl(res.accessToken) });
        }
    };

    const copyShare = async () => {
        if (!createdShare) return;
        try {
            await navigator.clipboard.writeText(createdShare.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            prompt('Copia el link:', createdShare.url);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {createdShare ? 'Estación creada' : 'Nueva estación'}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                        <X size={18} />
                    </button>
                </div>

                {createdShare ? (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-zinc-400">
                            <span className="font-bold text-gray-900 dark:text-zinc-100">
                                {createdShare.user.displayName}
                            </span>{' '}
                            ya puede entrar. Compartí este link con la estación —
                            es el único acceso que necesitan (no hay contraseña
                            separada).
                        </p>
                        <div className="rounded-xl border border-orange-200 dark:border-orange-900/40 bg-orange-50/60 dark:bg-orange-950/20 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-orange-700 dark:text-orange-400 mb-1">
                                Link de acceso
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-xs font-mono text-gray-700 dark:text-zinc-300 break-all">
                                    {createdShare.url}
                                </code>
                                <button
                                    type="button"
                                    onClick={copyShare}
                                    className={`p-2 rounded-lg shrink-0 ${
                                        copied
                                            ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300'
                                            : 'bg-orange-600 text-white hover:bg-orange-700'
                                    }`}
                                    title={copied ? 'Copiado' : 'Copiar link'}
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-zinc-500 italic">
                            Podés regenerar el link en cualquier momento desde la
                            tabla; el link viejo deja de funcionar al instante.
                        </p>
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 text-sm"
                            >
                                Listo
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-3">
                        <Field label="Nombre de la estación">
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="ej. Maquila San José"
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent"
                                required
                            />
                        </Field>
                        <Field label="Email">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="estacion@ejemplo.com"
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent"
                                required
                                autoComplete="off"
                            />
                        </Field>
                        <Field label="Etapa">
                            <select
                                value={stage}
                                onChange={(e) => setStage(e.target.value as StageKey)}
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-zinc-900"
                            >
                                {STAGE_ORDER.map((s) => (
                                    <option key={s} value={s}>
                                        {STAGE_LABELS[s]}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <p className="text-[11px] text-gray-500 dark:text-zinc-500 italic">
                            No se pide contraseña — el sistema genera un link
                            único de acceso que la estación puede guardar como
                            marcador.
                        </p>

                        {error && (
                            <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving && <Loader2 size={14} className="animate-spin" />}
                                Crear y generar link
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1">
                {label}
            </span>
            {children}
        </label>
    );
}
