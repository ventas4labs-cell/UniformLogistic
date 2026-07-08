import type { CartItem } from '@/lib/types';

// ─── Order product summary ───────────────────────────────────────────
// A compact, deduped list of the distinct product names in an order,
// shown on every operations-board card header so an order can be
// identified by what it contains at a glance (without expanding the
// per-size line list). Orange bullet + name, capped so multi-product
// orders don't tower over the rest of the grid.

const MAX_NAMES = 4;

export function OrderProductsSummary({
    items,
    className = ''
}: {
    items: CartItem[];
    className?: string;
}) {
    const names: string[] = [];
    for (const it of items) {
        const n = it.productName?.trim();
        if (n && !names.includes(n)) names.push(n);
    }
    if (names.length === 0) return null;

    const shown = names.slice(0, MAX_NAMES);
    const extra = names.length - shown.length;

    return (
        <ul className={`mt-2 space-y-1 ${className}`}>
            {shown.map((name) => (
                <li
                    key={name}
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-300"
                >
                    <span
                        aria-hidden
                        className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"
                    />
                    <span className="truncate">{name}</span>
                </li>
            ))}
            {extra > 0 && (
                <li className="pl-3.5 text-xs font-medium text-gray-400 dark:text-zinc-500">
                    +{extra} producto{extra === 1 ? '' : 's'} más
                </li>
            )}
        </ul>
    );
}
