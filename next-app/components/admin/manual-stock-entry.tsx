'use client';

import { useEffect, useMemo, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PackagePlus, X } from 'lucide-react';
import {
    addManualStockEntryAction,
    getManualStockCatalogAction
} from '@/app/(admin)/admin/stock/actions';
import type { VoiceCatalogEntry } from '@/lib/services/voice-catalog';
import { useDialog } from '@/lib/use-dialog';

interface CompanyOption {
    id: string;
    name: string;
}

export function ManualStockEntry({ companies }: { companies: CompanyOption[] }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={companies.length === 0}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <PackagePlus size={16} />
                Agregar stock
            </button>
            {open && <EntryModal companies={companies} onClose={() => setOpen(false)} />}
        </>
    );
}

function EntryModal({
    companies,
    onClose
}: {
    companies: CompanyOption[];
    onClose: () => void;
}) {
    const router = useRouter();
    const dialogRef = useDialog();
    const [companyId, setCompanyId] = useState(companies[0]?.id || '');
    const [catalog, setCatalog] = useState<VoiceCatalogEntry[]>([]);
    const [productId, setProductId] = useState('');
    const [size, setSize] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [loadingCatalog, setLoadingCatalog] = useState(true);
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getManualStockCatalogAction(companyId)
            .then((result) => {
                if (cancelled) return;
                setCatalog(result.entries);
                setError(result.error || null);
                setLoadingCatalog(false);
            })
            .catch(() => {
                if (cancelled) return;
                setError('No se pudo cargar el catálogo de productos.');
                setLoadingCatalog(false);
            });
        return () => { cancelled = true; };
    }, [companyId]);

    const products = useMemo(() => {
        const unique = new Map<string, VoiceCatalogEntry>();
        for (const entry of catalog) unique.set(entry.product_id, entry);
        return Array.from(unique.values()).sort((a, b) =>
            a.product_name.localeCompare(b.product_name, 'es')
        );
    }, [catalog]);
    const sizes = catalog.filter((entry) => entry.product_id === productId);
    const selectedCompany = companies.find((company) => company.id === companyId);
    const selectedProduct = products.find((product) => product.product_id === productId);
    const amount = Number(quantity);
    const validAmount =
        quantity.trim() !== '' && Number.isSafeInteger(amount) && amount >= 1 && amount <= 1_000_000;

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (loadingCatalog || !companyId || !productId || !size || !validAmount) return;
        setError(null);
        setSuccess(null);
        startTransition(async () => {
            try {
                const result = await addManualStockEntryAction({
                    companyId,
                    productId,
                    size,
                    quantity: amount,
                    reason
                });
                if (result.error) {
                    setError(result.error);
                    return;
                }
                setSuccess(`${amount} pieza${amount === 1 ? '' : 's'} agregada${amount === 1 ? '' : 's'} a ${selectedCompany?.name}: ${selectedProduct?.product_name} · ${size}.`);
                setQuantity('');
                setReason('');
                router.refresh();
            } catch {
                setError('No se pudo agregar el stock. Intentá de nuevo.');
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Agregar stock manualmente"
                tabIndex={-1}
                className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl my-8 outline-none text-gray-900 dark:text-zinc-100"
            >
                <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold">Agregar stock</h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-400">
                            Registrá una entrada manual en el inventario de una empresa.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={pending}
                        aria-label="Cerrar"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={submit} className="p-5 space-y-4">
                    <div>
                        <label htmlFor="entry-company" className="block text-sm font-semibold mb-1">Empresa</label>
                        <select
                            id="entry-company"
                            value={companyId}
                            onChange={(event) => {
                                setCompanyId(event.target.value);
                                setCatalog([]);
                                setProductId('');
                                setSize('');
                                setLoadingCatalog(true);
                                setError(null);
                                setSuccess(null);
                            }}
                            disabled={pending}
                            className="w-full p-2.5 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg"
                        >
                            {companies.map((company) => (
                                <option key={company.id} value={company.id}>{company.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="entry-product" className="block text-sm font-semibold mb-1">Producto</label>
                        <select
                            id="entry-product"
                            value={productId}
                            onChange={(event) => {
                                setProductId(event.target.value);
                                setSize('');
                                setError(null);
                                setSuccess(null);
                            }}
                            disabled={loadingCatalog || pending || products.length === 0}
                            required
                            className="w-full p-2.5 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg disabled:opacity-60"
                        >
                            <option value="">{loadingCatalog ? 'Cargando productos…' : 'Seleccioná un producto'}</option>
                            {products.map((product) => (
                                <option key={product.product_id} value={product.product_id}>
                                    {product.product_code} · {product.product_name}
                                </option>
                            ))}
                        </select>
                        {!loadingCatalog && products.length === 0 && !error && (
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                Esta empresa no tiene productos con tallas disponibles.
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="entry-size" className="block text-sm font-semibold mb-1">Talla</label>
                            <select
                                id="entry-size"
                                value={size}
                                onChange={(event) => {
                                    setSize(event.target.value);
                                    setError(null);
                                    setSuccess(null);
                                }}
                                disabled={!productId || pending}
                                required
                                className="w-full p-2.5 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg disabled:opacity-60"
                            >
                                <option value="">Seleccioná talla</option>
                                {sizes.map((entry) => (
                                    <option key={entry.size} value={entry.size}>{entry.size}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="entry-quantity" className="block text-sm font-semibold mb-1">Piezas a agregar</label>
                            <input
                                id="entry-quantity"
                                type="number"
                                inputMode="numeric"
                                min="1"
                                max="1000000"
                                step="1"
                                value={quantity}
                                onChange={(event) => {
                                    setQuantity(event.target.value);
                                    setError(null);
                                    setSuccess(null);
                                }}
                                disabled={pending}
                                required
                                placeholder="0"
                                className="w-full p-2.5 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="entry-reason" className="block text-sm font-semibold mb-1">Motivo (opcional)</label>
                        <input
                            id="entry-reason"
                            type="text"
                            value={reason}
                            maxLength={200}
                            onChange={(event) => setReason(event.target.value)}
                            disabled={pending}
                            placeholder="Ej. Recepción de mercadería"
                            className="w-full p-2.5 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg"
                        />
                    </div>

                    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
                    {success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p>}

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} disabled={pending} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 font-semibold text-sm disabled:opacity-50">
                            Cerrar
                        </button>
                        <button
                            type="submit"
                            disabled={pending || loadingCatalog || !productId || !size || !validAmount}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {pending ? <Loader2 size={16} className="animate-spin" /> : <PackagePlus size={16} />}
                            Agregar piezas
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
