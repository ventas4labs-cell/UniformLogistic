'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';

interface Props {
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
    // Width of the expanded input. Default fits the inline title-row use.
    expandedClassName?: string;
}

// Search affordance shared across admin boards. Collapsed by default
// to just a magnifying-glass icon button; clicking expands to an
// autofocused input. Empties + losing focus collapses back.
export function CollapsibleSearch({
    value,
    onChange,
    placeholder = 'Buscar…',
    expandedClassName = 'w-64'
}: Props) {
    const [open, setOpen] = useState(false);
    const expanded = open || !!value;

    if (!expanded) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                title="Buscar"
                aria-label="Buscar"
            >
                <Search size={18} />
            </button>
        );
    }

    return (
        <div className={`relative ${expandedClassName}`}>
            <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
                size={16}
            />
            <input
                type="search"
                autoFocus
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => {
                    if (!value) setOpen(false);
                }}
                placeholder={placeholder}
                className="w-full pl-9 pr-8 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-zinc-900 text-sm"
            />
            {value && (
                <button
                    type="button"
                    onClick={() => {
                        onChange('');
                        setOpen(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-300"
                    aria-label="Limpiar búsqueda"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
}
