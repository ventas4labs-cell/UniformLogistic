'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, HardHat, Loader2, X } from 'lucide-react';
import type { Order } from '@/lib/types';
import type { StationUser } from '@/lib/services/station-users';
import {
    STAGE_LABELS,
    STAGE_ORDER,
    type StageKey
} from '@/lib/services/stage-completions';
import { bulkAssignStationToOrdersAction } from '@/app/(admin)/admin/station-users/actions';

interface Props {
    selectedOrderIds: string[];
    selectedOrders: Order[];
    stationUsers: StationUser[];
    onCancel: () => void;
    onAssigned: (orderIds: string[], stationUserId: string) => void;
}

// Sticky bottom bar shown while OrdersTable is in selection mode.
// Two-step flow: (1) pick the station to assign to, then
// (2) confirm in a modal that lists the selected orders so the
// admin can sanity-check before committing the batch.
export function BulkAssignBar({
    selectedOrderIds,
    selectedOrders,
    stationUsers,
    onCancel,
    onAssigned
}: Props) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const count = selectedOrderIds.length;

    return (
        <>
            <div className="fixed inset-x-0 bottom-0 z-30 bg-gray-900 dark:bg-zinc-900 text-white shadow-2xl border-t border-gray-800 dark:border-zinc-800">
                <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-600 font-extrabold text-sm">
                            {count}
                        </span>
                        <div className="leading-tight">
                            <p className="text-sm font-bold">
                                {count === 0
                                    ? 'Seleccioná pedidos para asignar'
                                    : count === 1
                                        ? '1 pedido seleccionado'
                                        : `${count} pedidos seleccionados`}
                            </p>
                            <p className="text-[11px] text-gray-300 dark:text-zinc-400">
                                Tocá cada pedido para alternar la selección.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-3 py-2 rounded-lg text-sm font-bold bg-white/10 hover:bg-white/20"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            disabled={count === 0}
                            onClick={() => setPickerOpen(true)}
                            className="px-4 py-2 rounded-lg text-sm font-bold bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                            Continuar
                            <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {pickerOpen && (
                <BulkAssignModal
                    selectedOrderIds={selectedOrderIds}
                    selectedOrders={selectedOrders}
                    stationUsers={stationUsers}
                    onClose={() => setPickerOpen(false)}
                    onAssigned={(stationUserId) => {
                        onAssigned(selectedOrderIds, stationUserId);
                        setPickerOpen(false);
                    }}
                />
            )}
        </>
    );
}

function BulkAssignModal({
    selectedOrderIds,
    selectedOrders,
    stationUsers,
    onClose,
    onAssigned
}: {
    selectedOrderIds: string[];
    selectedOrders: Order[];
    stationUsers: StationUser[];
    onClose: () => void;
    onAssigned: (stationUserId: string) => void;
}) {
    const router = useRouter();
    const activeStations = useMemo(
        () => stationUsers.filter((u) => u.isActive),
        [stationUsers]
    );
    const stationsByStage = useMemo(() => {
        const map = new Map<StageKey, StationUser[]>();
        for (const u of activeStations) {
            const cur = map.get(u.stage) || [];
            cur.push(u);
            map.set(u.stage, cur);
        }
        return map;
    }, [activeStations]);

    const [stationUserId, setStationUserId] = useState<string>(
        activeStations[0]?.id || ''
    );
    const [confirming, setConfirming] = useState(false);
    const [pending, startTransition] = useTransition();
    const [result, setResult] = useState<{ created: number; existing: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const selectedStation = activeStations.find((u) => u.id === stationUserId);

    const submit = () => {
        if (!stationUserId) {
            setError('Selecciona la estación.');
            return;
        }
        setError(null);
        startTransition(async () => {
            const res = await bulkAssignStationToOrdersAction(selectedOrderIds, stationUserId);
            if (res.error) {
                setError(res.error);
                return;
            }
            setResult({
                created: res.created || 0,
                existing: res.existing || 0
            });
        });
    };

    // After a successful batch the modal shows a short success summary
    // then the parent closes selection mode + refreshes the page.
    const handleFinish = () => {
        onAssigned(stationUserId);
        router.refresh();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={result ? undefined : onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <HardHat size={18} className="text-orange-600 dark:text-orange-400" />
                            {result
                                ? 'Asignación completada'
                                : confirming
                                    ? 'Confirmar asignación'
                                    : 'Asignar a estación externa'}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                            {result
                                ? 'Las estaciones verán los pedidos la próxima vez que inicien sesión.'
                                : `${selectedOrderIds.length} pedido${selectedOrderIds.length === 1 ? '' : 's'} seleccionado${selectedOrderIds.length === 1 ? '' : 's'}.`}
                        </p>
                    </div>
                    {!result && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0"
                            aria-label="Cerrar"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {result ? (
                        <div className="text-center space-y-2">
                            <div className="mx-auto w-14 h-14 rounded-full bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 flex items-center justify-center">
                                <CheckCircle2 size={28} />
                            </div>
                            <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                                {result.created > 0
                                    ? `${result.created} pedido${result.created === 1 ? '' : 's'} asignado${result.created === 1 ? '' : 's'} a ${selectedStation?.displayName}.`
                                    : 'No se creó ninguna asignación nueva.'}
                            </p>
                            {result.existing > 0 && (
                                <p className="text-xs text-gray-500 dark:text-zinc-400">
                                    {result.existing} ya estaba{result.existing === 1 ? '' : 'n'} asignado{result.existing === 1 ? '' : 's'} a esta estación.
                                </p>
                            )}
                        </div>
                    ) : !confirming ? (
                        <div className="space-y-4">
                            <label className="block">
                                <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1">
                                    Estación
                                </span>
                                {activeStations.length === 0 ? (
                                    <p className="text-sm text-gray-500 dark:text-zinc-500 italic py-4 text-center">
                                        No hay estaciones activas. Creá una desde
                                        <span className="font-semibold"> Admin → Estaciones</span>.
                                    </p>
                                ) : (
                                    <select
                                        value={stationUserId}
                                        onChange={(e) => setStationUserId(e.target.value)}
                                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-zinc-900"
                                    >
                                        {STAGE_ORDER.flatMap((stage) => {
                                            const users = stationsByStage.get(stage) || [];
                                            if (users.length === 0) return [];
                                            return [
                                                <optgroup key={stage} label={STAGE_LABELS[stage]}>
                                                    {users.map((u) => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.displayName}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ];
                                        })}
                                    </select>
                                )}
                            </label>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">
                                    {error}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-sm text-gray-700 dark:text-zinc-300">
                                Vas a asignar los siguientes pedidos a{' '}
                                <span className="font-bold text-orange-600 dark:text-orange-400">
                                    {selectedStation?.displayName}
                                </span>{' '}
                                <span className="text-xs text-gray-500 dark:text-zinc-400">
                                    ({selectedStation && STAGE_LABELS[selectedStation.stage]})
                                </span>
                                :
                            </p>
                            <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-zinc-800">
                                <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {selectedOrders.map((o) => (
                                        <li
                                            key={o.uuid || o.id}
                                            className="px-3 py-2 text-sm flex items-center justify-between"
                                        >
                                            <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                                                {o.id}
                                            </span>
                                            <span className="text-gray-600 dark:text-zinc-400 truncate ml-2">
                                                {o.companyName || '—'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-zinc-500">
                                Pedidos que ya estuvieran asignados a esta
                                estación se ignoran sin error.
                            </p>
                            {error && (
                                <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-zinc-800 flex justify-end gap-2">
                    {result ? (
                        <button
                            type="button"
                            onClick={handleFinish}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 text-sm"
                        >
                            Listo
                        </button>
                    ) : !confirming ? (
                        <>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={!stationUserId || activeStations.length === 0}
                                onClick={() => {
                                    setError(null);
                                    setConfirming(true);
                                }}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                            >
                                Continuar
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => setConfirming(false)}
                                disabled={pending}
                                className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg disabled:opacity-40"
                            >
                                Atrás
                            </button>
                            <button
                                type="button"
                                onClick={submit}
                                disabled={pending}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-40 text-sm flex items-center gap-2"
                            >
                                {pending && <Loader2 size={14} className="animate-spin" />}
                                Confirmar asignación
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
