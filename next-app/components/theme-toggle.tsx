'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

function readInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem('theme') as Theme | null;
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeToggle({ className = '' }: { className?: string }) {
    // Start "unset" so SSR markup is stable; we sync from the actual DOM state
    // (set by the no-flash script in <head>) on mount.
    const [theme, setTheme] = useState<Theme | null>(null);

    useEffect(() => {
        setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    }, []);

    const apply = (next: Theme) => {
        const root = document.documentElement;
        root.classList.toggle('dark', next === 'dark');
        root.style.colorScheme = next;
        try {
            window.localStorage.setItem('theme', next);
        } catch {
            /* localStorage blocked — silently keep in-memory state */
        }
        setTheme(next);
    };

    const toggle = () => {
        const current = theme ?? readInitialTheme();
        apply(current === 'dark' ? 'light' : 'dark');
    };

    const isDark = theme === 'dark';
    const label = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

    return (
        <button
            type="button"
            onClick={toggle}
            title={label}
            aria-label={label}
            className={`p-2.5 rounded-xl bg-zinc-100 text-zinc-600 hover:bg-orange-50 hover:text-orange-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white transition-colors active:scale-90 ${className}`}
        >
            {/* Render both icons but swap visibility via Tailwind so the icon
                matches whatever class is on <html>, even before hydration. */}
            <Sun size={20} className="hidden dark:inline" />
            <Moon size={20} className="dark:hidden" />
        </button>
    );
}
