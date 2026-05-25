'use client';

export type StageTab = 'pending' | 'done' | 'all';

interface Props {
    tab: StageTab;
    setTab: (t: StageTab) => void;
    counts: { pending: number; done: number; all: number };
}

// Shared "Pendientes / Completados / Todos" filter for the four
// operations boards. Default tab is 'pending' so each board lands on
// the work that still needs doing.
export function StageTabBar({ tab, setTab, counts }: Props) {
    const tabs: { key: StageTab; label: string; count: number }[] = [
        { key: 'pending', label: 'Pendientes', count: counts.pending },
        { key: 'done', label: 'Completados', count: counts.done },
        { key: 'all', label: 'Todos', count: counts.all }
    ];
    return (
        <div className="flex gap-1.5 mb-4">
            {tabs.map((t) => (
                <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
                        tab === t.key
                            ? 'bg-orange-600 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                    }`}
                >
                    {t.label}
                    <span
                        className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${
                            tab === t.key
                                ? 'bg-white/20 text-white'
                                : 'bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400'
                        }`}
                    >
                        {t.count}
                    </span>
                </button>
            ))}
        </div>
    );
}
