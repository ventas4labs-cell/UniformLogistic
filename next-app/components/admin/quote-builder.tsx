'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Plus,
    Trash2,
    Loader2,
    Download,
    Save,
    ImageIcon,
    Search,
    Sticker
} from 'lucide-react';
import type { CatalogItem } from '@/lib/services/catalog-items';
import { imageForColor } from '@/lib/services/catalog-items';
import {
    computeQuoteTotals,
    lineSubtotal,
    QUOTE_STATUS_OPTIONS,
    formatQuoteRef,
    type Quote,
    type QuoteStatus,
    type QuoteLineInput
} from '@/lib/services/quotes';
import {
    createQuoteAction,
    updateQuoteAction,
    updateQuoteStatusAction,
    deleteQuoteAction
} from '@/app/(admin)/admin/cotizador/actions';

// Local draft line. `key` is client-side only (React list identity);
// `maxLogos` is carried from the catalog item so the logo stepper can
// clamp, and falls back to 10 for lines whose item was deleted.
interface DraftLine {
    key: string;
    catalogItemId: string | null;
    name: string;
    description: string;
    imageUrl: string;
    fabricType: string;
    color: string;
    unitPrice: number;
    pricePerLogo: number;
    quantity: number;
    logoCount: number;
    maxLogos: number;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const formatCRC = (n: number, currency = 'CRC') =>
    new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
    }).format(n);

export function QuoteBuilder({
    catalog,
    existing
}: {
    catalog: CatalogItem[];
    existing?: Quote;
}) {
    const router = useRouter();
    const catalogById = useMemo(
        () => new Map(catalog.map((c) => [c.id, c])),
        [catalog]
    );

    // ── Header state ────────────────────────────────────────────────
    const [clientName, setClientName] = useState(existing?.clientName ?? '');
    const [companyName, setCompanyName] = useState(existing?.companyName ?? '');
    const [contactEmail, setContactEmail] = useState(existing?.contactEmail ?? '');
    const [contactPhone, setContactPhone] = useState(existing?.contactPhone ?? '');
    const [quoteDate, setQuoteDate] = useState(existing?.quoteDate ?? todayISO());
    const [validUntil, setValidUntil] = useState(existing?.validUntil ?? '');
    const [notes, setNotes] = useState(existing?.notes ?? '');
    const [discountPct, setDiscountPct] = useState(existing?.discountPct ?? 0);
    const [taxPct, setTaxPct] = useState(existing?.taxPct ?? 13);
    const [status, setStatus] = useState<QuoteStatus>(existing?.status ?? 'draft');

    // ── Lines ───────────────────────────────────────────────────────
    const [lines, setLines] = useState<DraftLine[]>(() =>
        (existing?.items ?? []).map((it) => ({
            key: it.id,
            catalogItemId: it.catalogItemId,
            name: it.name,
            description: it.description,
            imageUrl: it.imageUrl,
            fabricType: it.fabricType,
            color: it.color,
            unitPrice: it.unitPrice,
            pricePerLogo: it.pricePerLogo,
            quantity: it.quantity,
            logoCount: it.logoCount,
            maxLogos: it.catalogItemId
                ? (catalogById.get(it.catalogItemId)?.maxLogos ?? 10)
                : 10
        }))
    );

    const [pickerSearch, setPickerSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedFlash, setSavedFlash] = useState(false);

    const filteredCatalog = useMemo(() => {
        const term = pickerSearch.trim().toLowerCase();
        if (!term) return catalog;
        return catalog.filter(
            (c) =>
                c.name.toLowerCase().includes(term) ||
                c.code.toLowerCase().includes(term) ||
                c.fabricType.toLowerCase().includes(term)
        );
    }, [catalog, pickerSearch]);

    const totals = computeQuoteTotals({ items: lines, discountPct, taxPct });

    const addFromCatalog = (item: CatalogItem) => {
        setLines((prev) => [
            ...prev,
            {
                key: crypto.randomUUID(),
                catalogItemId: item.id,
                name: item.name,
                description: item.description,
                // Default fabric/color to the item's first option so a
                // manually-built quote still carries a sensible spec.
                imageUrl: imageForColor(item, item.colorOptions[0]?.name ?? ''),
                fabricType: item.fabricOptions[0] ?? item.fabricType,
                color: item.colorOptions[0]?.name ?? '',
                unitPrice: item.unitPrice,
                pricePerLogo: item.pricePerLogo,
                quantity: 1,
                logoCount: 0,
                maxLogos: item.maxLogos
            }
        ]);
    };

    const patchLine = (key: string, patch: Partial<DraftLine>) => {
        setLines((prev) =>
            prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
        );
    };

    const removeLine = (key: string) => {
        setLines((prev) => prev.filter((l) => l.key !== key));
    };

    const buildPayload = (): { header: Parameters<typeof createQuoteAction>[0]; items: QuoteLineInput[] } => ({
        header: {
            status,
            clientName: clientName.trim() || undefined,
            companyName: companyName.trim() || undefined,
            contactEmail: contactEmail.trim() || undefined,
            contactPhone: contactPhone.trim() || undefined,
            quoteDate,
            validUntil: validUntil || null,
            notes: notes.trim() || undefined,
            discountPct,
            taxPct,
            currency: 'CRC'
        },
        items: lines.map((l, idx) => ({
            catalogItemId: l.catalogItemId,
            name: l.name,
            description: l.description || undefined,
            imageUrl: l.imageUrl || undefined,
            fabricType: l.fabricType || undefined,
            color: l.color || undefined,
            unitPrice: l.unitPrice,
            pricePerLogo: l.pricePerLogo,
            quantity: l.quantity,
            logoCount: l.logoCount,
            sortOrder: idx
        }))
    });

    const handleSave = async () => {
        if (lines.length === 0) {
            setError('Agregá al menos un producto a la cotización.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const { header, items } = buildPayload();
            if (existing) {
                await updateQuoteAction(existing.id, header, items);
                setSavedFlash(true);
                setTimeout(() => setSavedFlash(false), 2000);
                router.refresh();
            } else {
                const { id } = await createQuoteAction(header, items);
                router.push(`/admin/cotizador/${id}`);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (next: QuoteStatus) => {
        setStatus(next);
        if (existing) {
            try {
                await updateQuoteStatusAction(existing.id, next);
            } catch {
                alert('Error al cambiar estado');
                router.refresh();
            }
        }
    };

    const handleDelete = async () => {
        if (!existing) return;
        setDeleting(true);
        try {
            await deleteQuoteAction(existing.id);
            // deleteQuoteAction redirects; nothing else to do.
        } catch (e) {
            // redirect() throws internally in Next — swallow only real errors
            if (e instanceof Error && !e.message.includes('NEXT_REDIRECT')) {
                alert(`Error al eliminar: ${e.message}`);
                setDeleting(false);
            }
        }
    };

    const handlePdf = async () => {
        const { generateQuotePDF } = await import('@/lib/quote-pdf');
        const ref = existing ? existing.quoteRef : 'COT-BORRADOR';
        const doc = generateQuotePDF({
            quoteRef: ref,
            quoteDate,
            validUntil: validUntil || null,
            clientName,
            companyName,
            contactEmail,
            contactPhone,
            notes,
            discountPct,
            taxPct,
            currency: 'CRC',
            items: lines.map((l) => ({
                name: l.name,
                fabricType: l.fabricType,
                color: l.color,
                unitPrice: l.unitPrice,
                pricePerLogo: l.pricePerLogo,
                quantity: l.quantity,
                logoCount: l.logoCount
            }))
        });
        doc.save(`${ref}.pdf`);
    };

    const statusOpt = QUOTE_STATUS_OPTIONS.find((s) => s.value === status);

    return (
        <div>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/cotizador"
                        className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                        title="Volver al listado"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                            {existing ? (
                                <span className="font-mono text-orange-600 dark:text-orange-400">
                                    {existing.quoteRef}
                                </span>
                            ) : (
                                'Nueva cotización'
                            )}
                        </h2>
                        <p className="text-gray-500 dark:text-zinc-400 text-sm">
                            Armá la propuesta desde el catálogo default.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {existing && (
                        <select
                            value={status}
                            onChange={(e) => handleStatusChange(e.target.value as QuoteStatus)}
                            className={`py-1.5 px-3 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${statusOpt?.color || 'bg-gray-100 text-gray-800'}`}
                        >
                            {QUOTE_STATUS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={handlePdf}
                        disabled={lines.length === 0}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/50 rounded-lg hover:bg-orange-100 disabled:opacity-40"
                    >
                        <Download size={15} /> PDF
                    </button>
                    {existing && (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                            title="Eliminar cotización"
                        >
                            <Trash2 size={15} />
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-orange-600 rounded-lg hover:bg-orange-700 shadow-md disabled:bg-gray-300 dark:disabled:bg-zinc-700"
                    >
                        {saving ? (
                            <Loader2 className="animate-spin" size={15} />
                        ) : (
                            <Save size={15} />
                        )}
                        {savedFlash ? 'Guardado ✓' : 'Guardar'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/50">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-4 items-start">
                <div className="space-y-4">
                    {/* Client info */}
                    <section className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-5">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-400 mb-4">
                            Datos del cliente
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Empresa">
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                    placeholder="Empresa S.A."
                                />
                            </Field>
                            <Field label="Contacto">
                                <input
                                    type="text"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                    placeholder="Nombre de la persona"
                                />
                            </Field>
                            <Field label="Email">
                                <input
                                    type="email"
                                    value={contactEmail}
                                    onChange={(e) => setContactEmail(e.target.value)}
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                    placeholder="correo@empresa.com"
                                />
                            </Field>
                            <Field label="Teléfono">
                                <input
                                    type="tel"
                                    value={contactPhone}
                                    onChange={(e) => setContactPhone(e.target.value)}
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                    placeholder="8888-8888"
                                />
                            </Field>
                            <Field label="Fecha">
                                <input
                                    type="date"
                                    value={quoteDate}
                                    onChange={(e) => setQuoteDate(e.target.value)}
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </Field>
                            <Field label="Válida hasta">
                                <input
                                    type="date"
                                    value={validUntil ?? ''}
                                    onChange={(e) => setValidUntil(e.target.value)}
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </Field>
                        </div>
                        <Field label="Notas" className="mt-3">
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="Condiciones, tiempos de entrega, forma de pago…"
                            />
                        </Field>
                    </section>

                    {/* Catalog picker */}
                    <section className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-5">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-400">
                                Catálogo ({filteredCatalog.length})
                            </h3>
                            <div className="relative w-56">
                                <Search
                                    className="absolute left-2.5 top-2 text-gray-400 dark:text-zinc-500"
                                    size={14}
                                />
                                <input
                                    type="text"
                                    value={pickerSearch}
                                    onChange={(e) => setPickerSearch(e.target.value)}
                                    placeholder="Buscar…"
                                    className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                        </div>
                        {catalog.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-zinc-400 italic">
                                El catálogo default está vacío. Agregá items en{' '}
                                <Link
                                    href="/admin/catalogo-default"
                                    className="text-orange-600 dark:text-orange-400 font-bold hover:underline"
                                >
                                    Catálogo default
                                </Link>
                                .
                            </p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                {filteredCatalog.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => addFromCatalog(item)}
                                        className="group text-left bg-gray-50 dark:bg-zinc-800/50 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-800 hover:border-orange-400 hover:shadow-md transition-all"
                                        title="Agregar a la cotización"
                                    >
                                        <div className="relative aspect-square bg-white dark:bg-zinc-800">
                                            {item.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ImageIcon
                                                        size={28}
                                                        className="text-gray-300 dark:text-zinc-600"
                                                    />
                                                </div>
                                            )}
                                            <span className="absolute bottom-1.5 right-1.5 bg-orange-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow">
                                                <Plus size={14} strokeWidth={3} />
                                            </span>
                                        </div>
                                        <div className="p-2">
                                            <p className="text-xs font-bold text-gray-900 dark:text-zinc-100 truncate">
                                                {item.name}
                                            </p>
                                            <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mt-0.5">
                                                {formatCRC(item.unitPrice)}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Quote lines */}
                    <section className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-5">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-400 mb-4">
                            Líneas de la cotización ({lines.length})
                        </h3>
                        {lines.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-zinc-500 italic">
                                Hacé clic en un producto del catálogo para
                                agregarlo.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {lines.map((l) => (
                                    <div
                                        key={l.key}
                                        className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-3"
                                    >
                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white dark:bg-zinc-800 shrink-0 border border-gray-200 dark:border-zinc-700">
                                            {l.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={l.imageUrl}
                                                    alt={l.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ImageIcon
                                                        size={16}
                                                        className="text-gray-300 dark:text-zinc-600"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">
                                                {l.name}
                                            </p>
                                            {(() => {
                                                const src = l.catalogItemId
                                                    ? catalogById.get(l.catalogItemId)
                                                    : undefined;
                                                const fabrics = src?.fabricOptions ?? [];
                                                const colors = src?.colorOptions ?? [];
                                                return (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {fabrics.length > 0 ? (
                                                            <select
                                                                value={l.fabricType}
                                                                onChange={(e) =>
                                                                    patchLine(l.key, {
                                                                        fabricType: e.target.value
                                                                    })
                                                                }
                                                                className="text-[11px] p-1 border rounded bg-white dark:bg-zinc-900 focus:ring-1 focus:ring-orange-500 outline-none"
                                                            >
                                                                {fabrics.map((f) => (
                                                                    <option key={f} value={f}>
                                                                        {f}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            l.fabricType && (
                                                                <span className="text-[11px] text-gray-500 dark:text-zinc-400">
                                                                    {l.fabricType}
                                                                </span>
                                                            )
                                                        )}
                                                        {colors.length > 0 ? (
                                                            <select
                                                                value={l.color}
                                                                onChange={(e) => {
                                                                    const nextColor =
                                                                        e.target.value;
                                                                    patchLine(l.key, {
                                                                        color: nextColor,
                                                                        // Keep the line image in
                                                                        // sync with the color.
                                                                        imageUrl: src
                                                                            ? imageForColor(
                                                                                  src,
                                                                                  nextColor
                                                                              )
                                                                            : l.imageUrl
                                                                    });
                                                                }}
                                                                className="text-[11px] p-1 border rounded bg-white dark:bg-zinc-900 focus:ring-1 focus:ring-orange-500 outline-none"
                                                            >
                                                                {colors.map((c) => (
                                                                    <option key={c.name} value={c.name}>
                                                                        {c.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            l.color && (
                                                                <span className="text-[11px] text-gray-500 dark:text-zinc-400">
                                                                    {l.color}
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <label className="flex flex-col items-center gap-0.5">
                                            <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-zinc-500">
                                                ₡ unit.
                                            </span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={l.unitPrice}
                                                onChange={(e) =>
                                                    patchLine(l.key, {
                                                        unitPrice:
                                                            parseFloat(e.target.value) || 0
                                                    })
                                                }
                                                className="w-24 p-1.5 border rounded text-sm text-right focus:ring-2 focus:ring-orange-500 outline-none"
                                            />
                                        </label>
                                        <label className="flex flex-col items-center gap-0.5">
                                            <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-zinc-500">
                                                Cant.
                                            </span>
                                            <input
                                                type="number"
                                                min="1"
                                                value={l.quantity}
                                                onChange={(e) =>
                                                    patchLine(l.key, {
                                                        quantity: Math.max(
                                                            1,
                                                            parseInt(e.target.value, 10) || 1
                                                        )
                                                    })
                                                }
                                                className="w-16 p-1.5 border rounded text-sm text-center focus:ring-2 focus:ring-orange-500 outline-none"
                                            />
                                        </label>
                                        <label className="flex flex-col items-center gap-0.5">
                                            <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-zinc-500 inline-flex items-center gap-0.5">
                                                <Sticker size={9} /> Logos
                                            </span>
                                            <input
                                                type="number"
                                                min="0"
                                                max={l.maxLogos}
                                                value={l.logoCount}
                                                onChange={(e) =>
                                                    patchLine(l.key, {
                                                        logoCount: Math.max(
                                                            0,
                                                            Math.min(
                                                                l.maxLogos,
                                                                parseInt(e.target.value, 10) || 0
                                                            )
                                                        )
                                                    })
                                                }
                                                className="w-14 p-1.5 border rounded text-sm text-center focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-40"
                                                disabled={l.maxLogos === 0}
                                                title={
                                                    l.maxLogos === 0
                                                        ? 'Este item no admite logos'
                                                        : `Máximo ${l.maxLogos}`
                                                }
                                            />
                                        </label>
                                        <div className="w-24 text-right shrink-0">
                                            <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-zinc-500 block">
                                                Subtotal
                                            </span>
                                            <span className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                                                {formatCRC(lineSubtotal(l))}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => removeLine(l.key)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg shrink-0"
                                            title="Quitar línea"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                {/* Totals sidebar */}
                <aside className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm p-5 xl:sticky xl:top-4">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-400 mb-4">
                        Resumen
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600 dark:text-zinc-400">Subtotal</span>
                            <span className="font-bold">{formatCRC(totals.subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-gray-600 dark:text-zinc-400 flex items-center gap-2">
                                Descuento
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={discountPct}
                                    onChange={(e) =>
                                        setDiscountPct(
                                            Math.max(
                                                0,
                                                Math.min(100, parseFloat(e.target.value) || 0)
                                            )
                                        )
                                    }
                                    className="w-14 p-1 border rounded text-xs text-center focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                                %
                            </label>
                            <span className="font-bold text-red-600 dark:text-red-400">
                                {totals.discount > 0
                                    ? `- ${formatCRC(totals.discount)}`
                                    : '—'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-gray-600 dark:text-zinc-400 flex items-center gap-2">
                                IVA
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={taxPct}
                                    onChange={(e) =>
                                        setTaxPct(
                                            Math.max(
                                                0,
                                                Math.min(100, parseFloat(e.target.value) || 0)
                                            )
                                        )
                                    }
                                    className="w-14 p-1 border rounded text-xs text-center focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                                %
                            </label>
                            <span className="font-bold">{formatCRC(totals.tax)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-zinc-700">
                            <span className="font-bold text-gray-900 dark:text-zinc-100">
                                Total
                            </span>
                            <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                                {formatCRC(totals.total)}
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400 dark:text-zinc-500">
                            {lines.reduce((s, l) => s + l.quantity, 0)} piezas ·{' '}
                            {lines.length} líneas
                        </p>
                    </div>
                </aside>
            </div>

            {confirmDelete && existing && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => !deleting && setConfirmDelete(false)}
                >
                    <div
                        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-2">
                            ¿Eliminar {existing.quoteRef}?
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-5">
                            La cotización y sus líneas se eliminan de forma
                            permanente. El número {formatQuoteRef(existing.quoteNumber)}{' '}
                            no se reutiliza.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDelete(false)}
                                disabled={deleting}
                                className="flex-1 py-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
                            >
                                {deleting && <Loader2 className="animate-spin" size={16} />}
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Field({
    label,
    children,
    className = ''
}: {
    label: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={className}>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-400 mb-1">
                {label}
            </label>
            {children}
        </div>
    );
}
