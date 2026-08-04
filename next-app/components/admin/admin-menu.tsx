'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LogOut, X, ArrowLeft, ChevronDown, Search, Home } from 'lucide-react';
import { signOutAction } from '@/app/login/actions';
import { ThemeToggle } from '@/components/theme-toggle';
import {
    ADMIN_MODULES,
    PRINCIPAL_SUBGROUPS,
    activeModule,
    type AdminModule
} from '@/components/admin/admin-modules';

const OPERATIONS_TABS = ADMIN_MODULES.filter((m) => m.group === 'operaciones');

// Ordered, grouped view of every module. Principal is chunked into its
// sub-sections (≤4-ish each) so the launcher reads as scannable groups
// instead of a 14-item wall; Operaciones stays flat. This single ordered
// walk is also the keyboard-navigation order.
const GROUPED: { title: string; tabs: AdminModule[] }[] = [
    ...PRINCIPAL_SUBGROUPS.map((g) => ({
        title: g.label,
        tabs: ADMIN_MODULES.filter((m) => m.group === 'principal' && m.sub === g.key)
    })),
    { title: 'Operaciones', tabs: OPERATIONS_TABS }
].filter((s) => s.tabs.length > 0);

// Accent-insensitive fold for es-CR labels (á→a, ñ→n, …) so "impresion"
// matches "Impresión". ASCII-only source — no fragile combining-mark
// literals.
const ACCENTS: Record<string, string> = {
    á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n'
};
const norm = (s: string) =>
    s.toLowerCase().replace(/[áéíóúüñ]/g, (c) => ACCENTS[c] ?? c);

// The admin's only navigation, rebuilt as a command-launcher. The top bar
// shows a home crumb (UL logo) plus a labeled switcher that names the
// CURRENT module — so location is always visible without opening anything.
// Opening the launcher (click, or ⌘/Ctrl-K anywhere) reveals a type-to-
// filter combobox over every module with full keyboard navigation. Uses a
// real combobox/listbox ARIA contract (not a false role="menu").
export function AdminMenu() {
    const pathname = usePathname();
    const router = useRouter();
    const current = activeModule(pathname);

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(0);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Sections to render: filtered flat list while searching, grouped
    // otherwise. `flat` is the keyboard-navigation order across whatever
    // is visible.
    const { sections, flat } = useMemo(() => {
        const q = norm(query.trim());
        if (!q) {
            const secs = GROUPED;
            return { sections: secs, flat: secs.flatMap((s) => s.tabs) };
        }
        const hits = ADMIN_MODULES.filter((m) => norm(m.label).includes(q));
        return {
            sections: hits.length ? [{ title: 'Resultados', tabs: hits }] : [],
            flat: hits
        };
    }, [query]);

    // Clamp at read time so a shrinking filtered set never leaves the
    // highlight out of range (no setState-in-effect needed).
    const activeIndex = flat.length ? Math.min(highlight, flat.length - 1) : 0;
    const activeItem = flat[activeIndex];

    const close = () => {
        setOpen(false);
        setQuery('');
        setHighlight(0);
    };

    const go = (m: AdminModule | undefined) => {
        if (!m) return;
        close();
        router.push(m.href);
    };

    // Focus the filter input as the panel opens (combobox pattern —
    // type immediately, arrow through results).
    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    // ⌘/Ctrl-K opens the launcher from anywhere; Escape (when open) closes
    // and returns focus to the trigger.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen((o) => !o);
            } else if (e.key === 'Escape' && open) {
                close();
                triggerRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    // Close on outside click/tap.
    useEffect(() => {
        if (!open) return;
        const onPointer = (e: Event) => {
            const t = e.target as Node | null;
            if (wrapperRef.current && t && !wrapperRef.current.contains(t)) close();
        };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('touchstart', onPointer);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('touchstart', onPointer);
        };
    }, [open]);

    // Scroll the active option into view as the highlight moves.
    useEffect(() => {
        if (!open) return;
        const el = listRef.current?.querySelector<HTMLElement>(
            `[data-idx="${activeIndex}"]`
        );
        el?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, open]);

    const onInputKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => (flat.length ? (h + 1) % flat.length : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => (flat.length ? (h - 1 + flat.length) % flat.length : 0));
        } else if (e.key === 'Home') {
            e.preventDefault();
            setHighlight(0);
        } else if (e.key === 'End') {
            e.preventDefault();
            setHighlight(Math.max(0, flat.length - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            go(activeItem);
        }
    };

    return (
        <div className="relative flex items-center gap-1.5" ref={wrapperRef}>
            {/* Home crumb — logo returns to the panel home. */}
            <Link
                href="/admin/home"
                aria-label="Inicio · Uniform Logistic"
                className="relative w-11 h-11 rounded-xl overflow-hidden bg-zinc-900 dark:bg-zinc-800 shadow-md ring-1 ring-black/5 dark:ring-white/10 hover:ring-orange-500/40 transition-all active:scale-95 shrink-0"
            >
                <Image src="/ul-logo.png" alt="" fill sizes="44px" className="object-cover" />
            </Link>

            {/* Current-module switcher — names the location AND opens the
                launcher. A labeled target (not a bare logo), so it's
                discoverable on touch. */}
            <button
                type="button"
                ref={triggerRef}
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={`Módulo actual: ${current?.label ?? 'Admin'}. Abrir buscador de módulos`}
                className="group inline-flex items-center gap-2 h-11 pl-2.5 pr-2 rounded-xl text-sm font-bold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors max-w-[52vw] sm:max-w-none"
            >
                {current?.Icon ? (
                    <current.Icon size={18} className="text-orange-600 dark:text-orange-400 shrink-0" />
                ) : (
                    <Home size={18} className="text-orange-600 dark:text-orange-400 shrink-0" />
                )}
                <span className="truncate">{current?.label ?? 'Admin'}</span>
                <ChevronDown
                    size={16}
                    className="text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 shrink-0"
                />
                <kbd className="hidden lg:inline-flex items-center gap-0.5 ml-1 px-1.5 h-5 rounded-md border border-zinc-300 dark:border-zinc-700 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
                    ⌘K
                </kbd>
            </button>

            {/* Launcher panel — combobox + grouped listbox */}
            {open && (
                <div
                    role="dialog"
                    aria-label="Buscador de módulos"
                    className="absolute left-0 top-full mt-2 z-50 w-[calc(100vw-2rem)] sm:w-[34rem] max-w-[34rem] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
                >
                    {/* Filter input */}
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
                        <Search size={16} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setHighlight(0);
                            }}
                            onKeyDown={onInputKey}
                            role="combobox"
                            aria-expanded
                            aria-controls="admin-launcher-list"
                            aria-activedescendant={
                                activeItem ? `mod-${activeItem.id}` : undefined
                            }
                            aria-autocomplete="list"
                            placeholder="Buscar módulo…"
                            className="flex-1 bg-transparent outline-none text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                close();
                                triggerRef.current?.focus();
                            }}
                            aria-label="Cerrar"
                            className="w-8 h-8 -mr-1 rounded-lg flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Results */}
                    <div
                        ref={listRef}
                        id="admin-launcher-list"
                        role="listbox"
                        aria-label="Módulos"
                        className="max-h-[min(70vh,28rem)] overflow-y-auto p-2"
                    >
                        {sections.length === 0 && (
                            <p className="px-2 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                                Sin módulos para “{query.trim()}”.
                            </p>
                        )}
                        {sections.map((section) => (
                            <div key={section.title} className="mb-2 last:mb-0">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 px-2 pt-1 pb-1.5">
                                    {section.title}
                                </p>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                    {section.tabs.map((t) => {
                                        // Position in the flat keyboard-nav
                                        // order (module refs are stable).
                                        const myIdx = flat.indexOf(t);
                                        const active =
                                            pathname === t.href ||
                                            pathname?.startsWith(t.href + '/');
                                        const highlighted = myIdx === activeIndex;
                                        const Icon = t.Icon;
                                        return (
                                            <Link
                                                key={t.href}
                                                href={t.href}
                                                id={`mod-${t.id}`}
                                                role="option"
                                                data-idx={myIdx}
                                                aria-selected={highlighted}
                                                onClick={close}
                                                onMouseMove={() => setHighlight(myIdx)}
                                                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 min-h-[4.25rem] text-center transition-colors outline-none ${
                                                    active
                                                        ? 'bg-orange-600 text-white shadow-sm'
                                                        : highlighted
                                                          ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                                                          : 'text-zinc-700 dark:text-zinc-300'
                                                }`}
                                            >
                                                <span
                                                    className={
                                                        active
                                                            ? 'text-white'
                                                            : highlighted
                                                              ? 'text-orange-600 dark:text-orange-400'
                                                              : 'text-zinc-500 dark:text-zinc-400'
                                                    }
                                                >
                                                    <Icon size={22} />
                                                </span>
                                                <span className="text-[11px] font-semibold leading-tight">
                                                    {t.label}
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="px-3 py-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                            <Link
                                href="/catalog"
                                onClick={close}
                                className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                                <ArrowLeft size={16} />
                                Ir a la tienda
                            </Link>
                            <form action={signOutAction}>
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                    <LogOut size={16} />
                                    Salir
                                </button>
                            </form>
                        </div>
                        <ThemeToggle />
                    </div>
                </div>
            )}
        </div>
    );
}
