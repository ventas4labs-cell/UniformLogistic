import { ImageIcon, Package } from 'lucide-react';
import type { TopProduct } from '@/lib/customer-analytics';

// What the customer actually buys, ranked by pieces. The photo is the
// point — a name alone doesn't tell two uniform lines apart.

export function TopProducts({ products }: { products: TopProduct[] }) {
    const max = Math.max(1, ...products.map((p) => p.pieces));

    return (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <div className="mb-4">
                <h2 className="font-bold text-zinc-900 dark:text-zinc-100">Lo que más pides</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Por piezas pedidas, histórico.
                </p>
            </div>

            {products.length === 0 ? (
                <div className="text-sm text-zinc-400 dark:text-zinc-500 italic py-8 text-center">
                    <Package size={28} className="mx-auto mb-2 opacity-30" />
                    Aún no has hecho pedidos.
                </div>
            ) : (
                <ol className="space-y-3">
                    {products.map((p, i) => (
                        <li key={p.name} className="flex items-center gap-3">
                            <span className="w-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 shrink-0">
                                {i + 1}
                            </span>
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shrink-0">
                                {p.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={p.imageUrl}
                                        alt={p.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <ImageIcon
                                            size={14}
                                            className="text-zinc-300 dark:text-zinc-600"
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                        {p.name}
                                    </p>
                                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 shrink-0">
                                        {p.pieces}
                                    </span>
                                </div>
                                <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-orange-500/80"
                                        style={{ width: `${(p.pieces / max) * 100}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                                    en {p.orders} pedido{p.orders === 1 ? '' : 's'}
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}
