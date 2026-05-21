'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ChevronRight, Loader2 } from 'lucide-react';
import { useCart } from '@/components/cart-provider';
import { setActingCompanyAction } from './actions';
import type { Company } from '@/lib/services/companies';

interface Props {
    companies: Company[];
}

// Shown to the admin only — picks which customer company they are
// placing the order on behalf of. Choosing a company writes a cookie
// server-side, clears the local cart (a cart from a different company
// makes no sense), and re-renders /catalog with that company's products.
export function CompanyPicker({ companies }: Props) {
    const router = useRouter();
    const { clear } = useCart();
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [query, setQuery] = useState('');

    const filtered = companies.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase())
    );

    const handlePick = (companyId: string) => {
        setPendingId(companyId);
        clear();
        startTransition(async () => {
            const res = await setActingCompanyAction(companyId);
            if (res.error) {
                setPendingId(null);
                alert(res.error);
                return;
            }
            router.refresh();
        });
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-10">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 mb-4">
                    <Building2 size={28} />
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                    Hacer pedido a nombre de
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Escoge la empresa para la que vas a hacer el pedido. El catálogo y
                    los precios se ajustarán a su contrato.
                </p>
            </div>

            {companies.length > 6 && (
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar empresa…"
                    className="w-full mb-4 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 border border-transparent focus:border-orange-500 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none transition-colors"
                />
            )}

            <div className="space-y-2">
                {filtered.length === 0 ? (
                    <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">
                        No hay empresas registradas.
                    </p>
                ) : (
                    filtered.map((c) => {
                        const busy = isPending && pendingId === c.id;
                        return (
                            <button
                                key={c.id}
                                onClick={() => handlePick(c.id)}
                                disabled={isPending}
                                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50/40 dark:hover:bg-orange-950/20 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 group-hover:bg-orange-100 dark:group-hover:bg-orange-950/40 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors shrink-0">
                                    <Building2 size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                        {c.name}
                                    </p>
                                    {c.documentNumber && (
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                            Cédula: {c.documentNumber}
                                        </p>
                                    )}
                                </div>
                                {busy ? (
                                    <Loader2 size={18} className="text-orange-600 animate-spin shrink-0" />
                                ) : (
                                    <ChevronRight size={18} className="text-zinc-400 group-hover:text-orange-600 transition-colors shrink-0" />
                                )}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
