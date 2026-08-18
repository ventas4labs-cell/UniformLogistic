'use client';

import { useState, useTransition } from 'react';
import { PackageCheck, Loader2, CheckCircle2, Undo2 } from 'lucide-react';
import { setReadyForPickupAction } from '@/app/(admin)/admin/_stage-actions';
import { isAuthError, useSessionRecovery } from '@/components/session-recovery';

// Maquila station's collection signal. The station flags their finished
// order "listo para recoger"; once the office records it collected
// (picked_up_at), this becomes a read-only "Recogido" confirmation.
export function StationPickupControl({
    orderUuid,
    pickedUpAt,
    initialReadyAt
}: {
    orderUuid: string | undefined;
    pickedUpAt: string | null;
    initialReadyAt: string | null;
}) {
    const [readyAt, setReadyAt] = useState<string | null>(initialReadyAt);
    const [error, setError] = useState<string | null>(null);
    // Station kiosks can outlive their session — reconnect and retry.
    const recoverSession = useSessionRecovery();
    const [pending, startTransition] = useTransition();

    // Already collected by the office — nothing left for the station.
    if (pickedUpAt) {
        return (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white">
                <CheckCircle2 size={16} /> Recogido por la oficina
            </div>
        );
    }

    const toggle = (ready: boolean) => {
        if (!orderUuid) return;
        setError(null);
        const prev = readyAt;
        // Optimistic — a client timestamp is only used to flip the UI.
        setReadyAt(ready ? new Date().toISOString() : null);
        startTransition(async () => {
            let res = await setReadyForPickupAction(orderUuid, ready);
            if (isAuthError(res.error) && recoverSession && (await recoverSession())) {
                res = await setReadyForPickupAction(orderUuid, ready);
            }
            if (res.error) {
                setReadyAt(prev);
                setError('No se pudo actualizar. Probá de nuevo.');
            }
        });
    };

    if (readyAt) {
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle2 size={16} /> Listo para recoger · esperando a la oficina
                </div>
                <button
                    type="button"
                    onClick={() => toggle(false)}
                    disabled={pending}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                    {pending ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                    Deshacer
                </button>
            </div>
        );
    }

    return (
        <div>
            <button
                type="button"
                onClick={() => toggle(true)}
                disabled={!orderUuid || pending}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60"
            >
                {pending ? (
                    <Loader2 size={18} className="animate-spin" />
                ) : (
                    <PackageCheck size={18} />
                )}
                Marcar listo para recoger
            </button>
            {error && (
                <p className="mt-2 text-center text-xs font-semibold text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}
        </div>
    );
}
