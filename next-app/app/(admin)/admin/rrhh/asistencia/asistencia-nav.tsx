'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Day navigation for the attendance dashboard. Pure ?d= navigation so
// the page stays a server component.
export function AsistenciaNav({
    date,
    prevDate,
    nextDate,
    today,
    label
}: {
    date: string;
    prevDate: string;
    nextDate: string;
    today: string;
    label: string;
}) {
    const router = useRouter();
    const go = (d: string) => router.push(`/admin/rrhh/asistencia?d=${d}`);

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <button
                    type="button"
                    onClick={() => go(prevDate)}
                    className="p-2 text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    aria-label="Día anterior"
                >
                    <ChevronLeft size={16} />
                </button>
                <span className="px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-zinc-100 min-w-[180px] text-center capitalize">
                    {label}
                </span>
                <button
                    type="button"
                    onClick={() => go(nextDate)}
                    disabled={date >= today}
                    className="p-2 text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Día siguiente"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
            {date !== today && (
                <button
                    type="button"
                    onClick={() => go(today)}
                    className="px-3 py-1.5 text-sm font-bold text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-800 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/40"
                >
                    Hoy
                </button>
            )}
            <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => e.target.value && go(e.target.value)}
                className="px-2 py-1.5 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm bg-transparent"
            />
        </div>
    );
}
