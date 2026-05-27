'use client';

import { useMemo, useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, HardHat, Loader2, UserCheck, UserMinus } from 'lucide-react';
import type { StationUser } from '@/lib/services/station-users';
import { STAGE_LABELS, STAGE_ORDER, type StageKey } from '@/lib/services/stage-completions';
import {
    assignStationToOrderAction,
    unassignStationFromOrderAction
} from '@/app/(admin)/admin/station-users/actions';

interface Props {
    orderUuid: string;
    stationUsers: StationUser[];
    assignedIds: Set<string>;
    onLocalChange: (orderId: string, stationUserId: string, assigned: boolean) => void;
}

// Compact disclosure that shows which station users are assigned to
// this order and lets admin toggle them. Inactive station users are
// hidden — only active ones can be (un)assigned.
export function OrderAssignmentsPanel({
    orderUuid,
    stationUsers,
    assignedIds,
    onLocalChange
}: Props) {
    const [open, setOpen] = useState(false);
    const activeUsers = useMemo(
        () => stationUsers.filter((u) => u.isActive),
        [stationUsers]
    );
    const byStage = useMemo(() => {
        const map = new Map<StageKey, StationUser[]>();
        for (const u of activeUsers) {
            const cur = map.get(u.stage) || [];
            cur.push(u);
            map.set(u.stage, cur);
        }
        return map;
    }, [activeUsers]);

    const assignedUsers = activeUsers.filter((u) => assignedIds.has(u.id));

    return (
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors"
            >
                <span className="flex items-center gap-2">
                    <HardHat size={14} className="text-orange-600 dark:text-orange-400" />
                    Estaciones asignadas
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-[10px]">
                        {assignedUsers.length}
                    </span>
                </span>
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* When collapsed, show a compact summary of currently-assigned
                stations as chips so admin can scan at a glance. */}
            {!open && assignedUsers.length > 0 && (
                <div className="px-3 pb-2 flex flex-wrap gap-1">
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

            {open && (
                <div className="p-3 border-t border-gray-100 dark:border-zinc-800 space-y-3">
                    {activeUsers.length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-zinc-500 italic">
                            No hay estaciones registradas. Crealas desde Admin → Estaciones.
                        </p>
                    ) : (
                        STAGE_ORDER.map((stage) => {
                            const users = byStage.get(stage);
                            if (!users || users.length === 0) return null;
                            return (
                                <div key={stage}>
                                    <h5 className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-500 mb-1.5">
                                        {STAGE_LABELS[stage]}
                                    </h5>
                                    <div className="flex flex-wrap gap-1.5">
                                        {users.map((u) => (
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
                            );
                        })
                    )}
                </div>
            )}
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
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                isAssigned
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-orange-100 dark:hover:bg-orange-950/40 hover:text-orange-700 dark:hover:text-orange-300'
            }`}
        >
            {pending ? (
                <Loader2 size={11} className="animate-spin" />
            ) : isAssigned ? (
                <UserMinus size={11} />
            ) : (
                <UserCheck size={11} />
            )}
            {user.displayName}
        </button>
    );
}
