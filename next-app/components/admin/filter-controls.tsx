'use client';

// Shared finder-bar controls for the admin modules (Productos, Pedidos…).
// Keeping them in one place is what makes the finder read the same way
// everywhere: same active-orange treatment, same sizing, same a11y.

// Compact labelled dropdown. The label doubles as the "all" option
// ("Tipo: todos") so the control reads as a sentence and costs no
// vertical space; it turns orange while narrowing the list.
export function FilterSelect({
    label,
    value,
    onChange,
    options
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    const active = value !== 'all';
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            className={`text-sm font-semibold rounded-xl border px-3 py-2.5 outline-none cursor-pointer transition-colors focus:ring-2 focus:ring-orange-500/30 max-w-[11rem] ${
                active
                    ? 'border-orange-400 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300'
                    : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300'
            }`}
        >
            <option value="all">{label}: todos</option>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}

// On/off filter chip (Solo básicos, Sin CABYS, Con alertas…).
export function TogglePill({
    active,
    onClick,
    children
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                active
                    ? 'bg-orange-600 border-orange-600 text-white'
                    : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:border-orange-300 hover:text-orange-700 dark:hover:text-orange-300'
            }`}
        >
            {children}
        </button>
    );
}

// Single-choice pill group with a count on every option, for filters whose
// choices should stay in view (Estado, Estación) instead of hiding inside a
// dropdown or popover. The active pill is unmistakable, and each count is
// how many rows that choice would show given the other filters — so the
// active pill always matches what is on screen.
export function PillGroup<T extends string>({
    label,
    value,
    onChange,
    options
}: {
    label: string;
    value: T;
    onChange: (v: T) => void;
    options: { value: T; label: string; count: number; icon?: React.ReactNode }[];
}) {
    return (
        <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
            </span>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                {options.map((o) => {
                    const active = o.value === value;
                    return (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => onChange(o.value)}
                            aria-pressed={active}
                            className={`inline-flex items-center gap-1.5 px-3.5 min-h-11 rounded-lg text-sm font-bold transition-colors ${
                                active
                                    ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100'
                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                            }`}
                        >
                            {o.icon}
                            {o.label}
                            <span
                                className={`min-w-[1.3rem] px-1 rounded-full text-[11px] leading-5 tabular-nums ${
                                    active
                                        ? 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300'
                                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                                }`}
                            >
                                {o.count}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
