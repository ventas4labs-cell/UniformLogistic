'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    Building2,
    CheckCircle2,
    ChevronDown,
    ClipboardList,
    Package,
    Ruler
} from 'lucide-react';
import type { AdminTask, TaskGroup, TaskKind } from '@/lib/admin-tasks';

// ─── Tareas pendientes ───────────────────────────────────────────────
// The configuration gaps that only surface mid-production — a product
// with no BOM, an empresa with no catálogo, a line detached from its
// product. Each row links straight to the screen that fixes it.
//
// Long groups collapse to the worst few so a big backlog can't push the
// rest of Inicio off the screen.

const PREVIEW = 4;

const ICONS: Record<TaskKind, typeof Package> = {
    'order-detached': ClipboardList,
    'company-no-catalog': Building2,
    'product-no-bom': Package,
    'product-no-fabric': Ruler
};

const DOT: Record<AdminTask['severity'], string> = {
    high: 'bg-red-500',
    medium: 'bg-amber-500',
    low: 'bg-zinc-400 dark:bg-zinc-600'
};

export function PendingTasks({
    groups,
    total,
    highCount
}: {
    groups: TaskGroup[];
    total: number;
    highCount: number;
}) {
    if (total === 0) {
        return (
            <section>
                <SectionHeading total={0} highCount={0} />
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex items-center gap-3">
                    <CheckCircle2
                        className="text-emerald-600 dark:text-emerald-400 shrink-0"
                        size={22}
                    />
                    <div>
                        <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                            Todo al día
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Sin productos, empresas ni pedidos con datos faltantes.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section>
            <SectionHeading total={total} highCount={highCount} />
            <div className="grid gap-3 lg:grid-cols-2">
                {groups.map((g) => (
                    <TaskGroupCard key={g.kind} group={g} />
                ))}
            </div>
        </section>
    );
}

function SectionHeading({
    total,
    highCount
}: {
    total: number;
    highCount: number;
}) {
    return (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Tareas pendientes
            </h2>
            {total > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
                    {total}
                </span>
            )}
            {highCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300">
                    {highCount} urgente{highCount === 1 ? '' : 's'}
                </span>
            )}
        </div>
    );
}

function TaskGroupCard({ group }: { group: TaskGroup }) {
    const [expanded, setExpanded] = useState(false);
    const Icon = ICONS[group.kind];
    const shown = expanded ? group.tasks : group.tasks.slice(0, PREVIEW);
    const hidden = group.tasks.length - shown.length;

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
            <div className="px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0 rounded-lg bg-amber-50 dark:bg-amber-950/40 p-1.5">
                        <Icon
                            size={16}
                            className="text-amber-700 dark:text-amber-400"
                        />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                {group.title}
                            </h3>
                            <span className="font-display text-lg font-extrabold leading-none text-amber-600 dark:text-amber-400">
                                {group.tasks.length}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {group.blurb}
                        </p>
                    </div>
                </div>
            </div>

            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 flex-1">
                {shown.map((t) => (
                    <li key={t.id}>
                        <Link
                            href={t.href}
                            className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors group"
                        >
                            <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[t.severity]}`}
                                aria-hidden
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                                    {t.title}
                                </span>
                                <span className="block text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                    {t.detail}
                                </span>
                            </span>
                            {t.metric && (
                                <span className="hidden sm:block text-[11px] font-medium text-zinc-400 dark:text-zinc-500 shrink-0 whitespace-nowrap">
                                    {t.metric}
                                </span>
                            )}
                            <ArrowRight
                                size={14}
                                className="shrink-0 text-zinc-300 dark:text-zinc-600 group-hover:text-orange-500 transition-colors"
                            />
                        </Link>
                    </li>
                ))}
            </ul>

            {group.tasks.length > PREVIEW && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    aria-expanded={expanded}
                    className="w-full px-4 py-2 text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center gap-1 transition-colors"
                >
                    {expanded ? 'Ver menos' : `Ver ${hidden} más`}
                    <ChevronDown
                        size={13}
                        className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}
                    />
                </button>
            )}
        </div>
    );
}
