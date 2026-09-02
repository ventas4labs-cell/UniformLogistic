import { QrCode } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { fetchEmployee } from '@/lib/services/employees';
import {
    deriveState,
    fetchTodayPunches,
    lastPunchType,
    PUNCH_LABELS,
    STATE_LABELS,
    type PunchState
} from '@/lib/services/hr-punches';

const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-CR', {
        timeZone: 'America/Costa_Rica',
        hour: '2-digit',
        minute: '2-digit'
    });

const STATE_STYLE: Record<PunchState, string> = {
    working: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300',
    on_break: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    on_lunch: 'bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300',
    out: 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300'
};

export default async function EmpleadoHomePage() {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    const [employee, punches] = user
        ? await Promise.all([
              fetchEmployee(supabase, user.id),
              fetchTodayPunches(supabase, user.id)
          ])
        : [null, []];

    const state = deriveState(lastPunchType(punches));
    const firstName = employee?.fullName?.split(' ')[0] || '';

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                    Hola{firstName ? `, ${firstName}` : ''} 👋
                </h1>
                <div className="mt-2 inline-flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-zinc-400">Estado:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATE_STYLE[state]}`}>
                        {STATE_LABELS[state]}
                    </span>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center mb-3">
                    <QrCode size={24} className="text-orange-600 dark:text-orange-400" />
                </div>
                <p className="font-semibold text-gray-900 dark:text-zinc-100">
                    Escaneá el código del taller para marcar
                </p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                    Usá la cámara de tu teléfono sobre la pantalla del kiosco para
                    registrar tu entrada, salida, break o almuerzo.
                </p>
            </div>

            <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">
                    Marcajes de hoy
                </p>
                {punches.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-zinc-500">
                        Todavía no marcaste nada hoy.
                    </p>
                ) : (
                    <ul className="space-y-1.5">
                        {punches.map((p) => (
                            <li
                                key={p.id}
                                className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm"
                            >
                                <span className="text-gray-900 dark:text-zinc-100">
                                    {PUNCH_LABELS[p.punchType]}
                                </span>
                                <span className="font-mono text-gray-500 dark:text-zinc-400">
                                    {fmtTime(p.punchedAt)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
