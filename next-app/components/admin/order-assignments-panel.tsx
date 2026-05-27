'use client';

import { useMemo, useState, useTransition } from 'react';
import { HardHat, Loader2, UserCheck, UserMinus, UserPlus, X } from 'lucide-react';
import type { StationUser } from '@/lib/services/station-users';
import { STAGE_LABELS, STAGE_ORDER, type StageKey } from '@/lib/services/stage-completions';
import {
    assignStationToOrderAction,
    unassignStationFromOrderAction
} from '@/app/(admin)/admin/station-users/actions';

interface Props {
    orderUuid: string;
    orderRef?: string;
    stationUsers: StationUser[];
    assignedIds: Set<string>;
    onLocalChange: (orderId: string, stationUserId: string, assigned: boolean) => void;
}

// Per-card affordance for assigning external stations. Renders a
// prominent "Asignar estación" button + a chip strip of currently-
// assigned stations. The actual picker lives in a modal opened by the
// button — keeps the card compact and makes assignment one click away
// from anywhere on the card.
export function OrderAssignmentsPanel({
    orderUuid,
    orderRef,
    stationUsers,
    assignedIds,
    onLocalChange
}: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const activeUsers = useMemo(
        () => stationUsers.filter((u) => u.isActive),
        [stationUsers]
    );
    const assignedUsers = activeUsers.filter((u) => assignedIds.has(u.id));

    return (
        <>
            <div className="space-y-2">
                <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm ${
                        assignedUsers.length > 0
                            ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-950/60'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                    }`}
                >
                    {assignedUsers.length > 0 ? (
                        <>
                            <HardHat size={14} />
                            {assignedUsers.length} estación
                            {assignedUsers.length === 1 ? '' : 'es'} asignada
                            {assignedUsers.length === 1 ? '' : 's'} · Cambiar
                        </>
                    ) : (
                        <>
                            <UserPlus size={14} />
                            Asignar estación
                        </>
                    )}
                </button>

                {assignedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-1">
                        {assignedUsers.map((u) => (
                            <span
                                key={u.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-[10px] font-bold"
                                title={`${u.email} · ${STAGE_LABELS[u.stage]}`}
                            >
                                <UserCheck size={10} />
                                {u.displayName}
                                <span className="opacity-60">· {STAGE_LABELS[u.stage]}</span>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {modalOpen && (
                <AssignmentsModal
                    orderUuid={orderUuid}
                    orderRef={orderRef}
                    activeUsers={activeUsers}
                    assignedIds={assignedIds}
                    onLocalChange={onLocalChange}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </>
    );
}

function AssignmentsModal({
    orderUuid,
    orderRef,
    activeUsers,
    assignedIds,
    onLocalChange,
    onClose
}: {
    orderUuid: string;
    orderRef?: string;
    activeUsers: StationUser[];
    assignedIds: Set<string>;
    onLocalChange: Props['onLocalChange'];
    onClose: () => void;
}) {
    const byStage = useMemo(() => {
        const map = new Map<StageKey, StationUser[]>();
        for (const u of activeUsers) {
            const cur = map.get(u.stage) || [];
            cur.push(u);
            map.set(u.stage, cur);
        }
        return map;
    }, [activeUsers]);

    const stagesWithUsers = STAGE_ORDER.filter((s) => (byStage.get(s) || []).length > 0);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <HardHat size={18} className="text-orange-600 dark:text-orange-400" />
                            Asignar estaciones
                        </h3>
                        {orderRef && (
                            <p className="text-xs font-mono text-gray-500 dark:text-zinc-500 mt-0.5">
                                {orderRef}
                            </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                            Tocá una estación para asignarla; tocá de nuevo para
                            quitarla. Solo verá este pedido la próxima vez que
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

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {activeUsers.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-zinc-500 italic text-center py-8">
                            No hay estaciones activas. Crealas desde
                            <span className="font-semibold"> Admin → Estaciones</span>.
                        </p>
                    ) : (
                        stagesWithUsers.map((stage) => (
                            <div key={stage}>
                                <h5 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-500 mb-2">
                                    {STAGE_LABELS[stage]}
                                </h5>
                                <div className="flex flex-wrap gap-2">
                                    {(byStage.get(stage) || []).map((u) => (
                                        <StationChip
                                            key={u.id}
                                            user={u}
                                            orderUuid={orderUuid}
                                            isAssigned={assignedIds.has(u.id)}
                                            onLocalChange={onLocalChange}
                                        />
                                    ))}
                                </div>
                            </div>
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

function StationChip({
    user,
    orderUuid,
    isAssigned,
    onLocalChange
}: {
    user: StationUser;
    orderUuid: string;
    isAssigned: boolean;
    onLocalChange: Props['onLocalChange'];
}) {
    const [pending, startTransition] = useTransition();

    const handleClick = () => {
        const next = !isAssigned;
        onLocalChange(orderUuid, user.id, next);
        startTransition(async () => {
            const res = next
                ? await assignStationToOrderAction(orderUuid, user.id)
                : await unassignStationFromOrderAction(orderUuid, user.id);
            if (res.error) {
                onLocalChange(orderUuid, user.id, isAssigned);
                alert(res.error);
            }
        });
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={pending}
            title={user.email}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
                isAssigned
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-orange-100 dark:hover:bg-orange-950/40 hover:text-orange-700 dark:hover:text-orange-300'
            }`}
        >
            {pending ? (
                <Loader2 size={12} className="animate-spin" />
            ) : isAssigned ? (
                <UserMinus size={12} />
            ) : (
                <UserCheck size={12} />
            )}
            {user.displayName}
        </button>
    );
}
