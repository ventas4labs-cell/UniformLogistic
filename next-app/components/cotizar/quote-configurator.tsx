'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    Plus,
    Minus,
    Trash2,
    X,
    ImageIcon,
    Sticker,
    Search,
    Loader2,
    CheckCircle2,
    Download,
    ShoppingBag
} from 'lucide-react';
import type { CatalogItem } from '@/lib/services/catalog-items';
import { imageForColor } from '@/lib/services/catalog-items';
import {
    computeQuoteTotals,
    lineSubtotal,
    type QuoteLineInput
} from '@/lib/services/quotes';
import {
    submitCustomerQuoteAction,
    type CustomerContact,
    type SubmitResult
} from '@/app/cotizar/actions';

const IVA_PCT = 13;

// Quick-pick order sizes for the configurator. The +/- stepper still
// lets a customer land on an in-between quantity without typing.
const QTY_PRESETS = [25, 50, 100, 300, 500];

const formatCRC = (n: number) =>
    new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: 'CRC',
        maximumFractionDigits: 0
    }).format(n);

// A configured line sitting in the customer's cart.
interface CartLine {
    key: string;
    catalogItemId: string;
    name: string;
    imageUrl: string;
    fabricType: string;
    color: string;
    unitPrice: number;
    pricePerLogo: number;
    maxLogos: number;
    logoCount: number;
    quantity: number;
}

export function QuoteConfigurator({ catalog }: { catalog: CatalogItem[] }) {
    const [search, setSearch] = useState('');
    const [configuring, setConfiguring] = useState<CatalogItem | null>(null);
    const [cart, setCart] = useState<CartLine[]>([]);
    const [contact, setContact] = useState<CustomerContact>({
        clientName: '',
        companyName: '',
        email: '',
        phone: '',
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<SubmitResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return catalog;
        return catalog.filter(
            (c) =>
                c.name.toLowerCase().includes(term) ||
                c.fabricType.toLowerCase().includes(term) ||
                c.fabricOptions.some((f) => f.toLowerCase().includes(term))
        );
    }, [catalog, search]);

    const totals = computeQuoteTotals({ items: cart, discountPct: 0, taxPct: IVA_PCT });
    const totalPieces = cart.reduce((s, l) => s + l.quantity, 0);

    const addToCart = (line: Omit<CartLine, 'key'>) => {
        setCart((prev) => [...prev, { ...line, key: crypto.randomUUID() }]);
        setConfiguring(null);
    };

    const updateQty = (key: string, qty: number) =>
        setCart((prev) =>
            prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, qty) } : l))
        );

    const removeLine = (key: string) =>
        setCart((prev) => prev.filter((l) => l.key !== key));

    const handleSubmit = async () => {
        if (cart.length === 0) {
            setError('Agregá al menos un producto a tu cotización.');
            return;
        }
        if (!contact.email.trim() && !contact.phone.trim()) {
            setError('Dejanos un correo o teléfono para poder responderte.');
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            const items: QuoteLineInput[] = cart.map((l, idx) => ({
                catalogItemId: l.catalogItemId,
                name: l.name,
                imageUrl: l.imageUrl || undefined,
                fabricType: l.fabricType || undefined,
                color: l.color || undefined,
                unitPrice: l.unitPrice,
                pricePerLogo: l.pricePerLogo,
                quantity: l.quantity,
                logoCount: l.logoCount,
                sortOrder: idx
            }));
            const res = await submitCustomerQuoteAction(contact, items);
            if (!res.ok) {
                setError(res.error || 'No pudimos enviar la cotización.');
            } else {
                setResult(res);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al enviar.');
        } finally {
            setSubmitting(false);
        }
    };

    const downloadPdf = async (ref: string) => {
        const { generateQuotePDF } = await import('@/lib/quote-pdf');
        const doc = generateQuotePDF({
            quoteRef: ref,
            quoteDate: new Date().toISOString().slice(0, 10),
            validUntil: null,
            clientName: contact.clientName,
            companyName: contact.companyName,
            contactEmail: contact.email,
            contactPhone: contact.phone,
            notes: contact.notes,
            discountPct: 0,
            taxPct: IVA_PCT,
            currency: 'CRC',
            items: cart.map((l) => ({
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

    // ── Success screen ──────────────────────────────────────────────
    if (result?.ok) {
        return (
            <main className="min-h-screen bg-[#F7F4EE] text-[#16130F] flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-5">
                        <CheckCircle2 size={34} className="text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">¡Cotización enviada!</h1>
                    <p className="text-gray-600 mb-1">
                        Tu número de cotización es{' '}
                        <span className="font-mono font-bold text-[#EA580C]">
                            {result.quoteRef}
                        </span>
                        .
                    </p>
                    <p className="text-gray-600 text-sm mb-6">
                        Nuestro equipo la revisará y te contactará pronto con la
                        propuesta final. Mientras tanto, podés descargar una copia.
                    </p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => result.quoteRef && downloadPdf(result.quoteRef)}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#EA580C] text-white rounded-full font-bold hover:bg-[#16130F] transition-colors"
                        >
                            <Download size={16} /> Descargar PDF
                        </button>
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-[#16130F]/20 rounded-full font-bold hover:bg-[#16130F] hover:text-white transition-colors"
                        >
                            Volver al inicio
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#F7F4EE] text-[#16130F]">
            {/* Top bar */}
            <header className="sticky top-0 z-30 bg-[#F7F4EE]/90 backdrop-blur border-b border-[#16130F]/10">
                <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 font-bold text-sm hover:text-[#EA580C] transition-colors"
                    >
                        <ArrowLeft size={16} /> Uniform Logistic
                    </Link>
                    <div className="flex items-center gap-2 text-sm font-bold text-[#16130F]/70">
                        <ShoppingBag size={16} className="text-[#EA580C]" />
                        {cart.length} {cart.length === 1 ? 'producto' : 'productos'}
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-6xl px-6 py-10">
                <div className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                        Cotizá tus uniformes
                    </h1>
                    <p className="text-[#16130F]/60 mt-2 max-w-xl">
                        Elegí el producto, la tela, el color y cuántos logos lleva.
                        El precio se calcula al instante. Cuando termines, envianos
                        tus datos y te contactamos.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-8 items-start">
                    {/* Catalog */}
                    <div>
                        <div className="relative mb-5 max-w-sm">
                            <Search
                                className="absolute left-3 top-3 text-[#16130F]/40"
                                size={18}
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar producto o tela…"
                                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-[#16130F]/15 bg-white outline-none focus:border-[#EA580C]"
                            />
                        </div>

                        {catalog.length === 0 ? (
                            <div className="bg-white rounded-2xl p-10 text-center text-[#16130F]/60">
                                Todavía no hay productos publicados. Escribinos a{' '}
                                <a
                                    href="mailto:ulogisticcr@gmail.com"
                                    className="text-[#EA580C] font-bold"
                                >
                                    ulogisticcr@gmail.com
                                </a>{' '}
                                y te cotizamos a la medida.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {filtered.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setConfiguring(item)}
                                        className="group text-left bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg border border-transparent hover:border-[#EA580C]/30 transition-all"
                                    >
                                        <div className="relative aspect-square bg-[#F1EDE4]">
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
                                                        size={32}
                                                        className="text-[#16130F]/20"
                                                    />
                                                </div>
                                            )}
                                            <span className="absolute bottom-2 right-2 bg-[#EA580C] text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow">
                                                <Plus size={16} strokeWidth={3} />
                                            </span>
                                        </div>
                                        <div className="p-3">
                                            <p className="font-bold text-sm leading-tight">
                                                {item.name}
                                            </p>
                                            <p className="text-[#EA580C] font-bold mt-1">
                                                {formatCRC(item.unitPrice)}
                                            </p>
                                            <p className="text-[11px] text-[#16130F]/50 mt-0.5">
                                                desde · por unidad
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Cart + contact */}
                    <aside className="lg:sticky lg:top-20 space-y-4">
                        <div className="bg-white rounded-2xl shadow-sm p-5">
                            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <ShoppingBag size={18} className="text-[#EA580C]" />
                                Tu cotización
                            </h2>
                            {cart.length === 0 ? (
                                <p className="text-sm text-[#16130F]/50 italic py-6 text-center">
                                    Todavía no agregaste productos. Tocá un producto
                                    para configurarlo.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {cart.map((l) => (
                                        <div
                                            key={l.key}
                                            className="flex gap-3 pb-3 border-b border-[#16130F]/8 last:border-0 last:pb-0"
                                        >
                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#F1EDE4] shrink-0">
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
                                                            className="text-[#16130F]/20"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-bold text-sm leading-tight truncate">
                                                    {l.name}
                                                </p>
                                                <p className="text-[11px] text-[#16130F]/50">
                                                    {[l.fabricType, l.color]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                    {l.logoCount > 0 &&
                                                        ` · ${l.logoCount} logo${l.logoCount === 1 ? '' : 's'}`}
                                                </p>
                                                <div className="flex items-center justify-between mt-1.5">
                                                    <div className="inline-flex items-center border border-[#16130F]/15 rounded-full">
                                                        <button
                                                            onClick={() =>
                                                                updateQty(l.key, l.quantity - 1)
                                                            }
                                                            className="p-1 hover:text-[#EA580C]"
                                                            aria-label="Menos"
                                                        >
                                                            <Minus size={12} />
                                                        </button>
                                                        <span className="text-xs font-bold w-7 text-center">
                                                            {l.quantity}
                                                        </span>
                                                        <button
                                                            onClick={() =>
                                                                updateQty(l.key, l.quantity + 1)
                                                            }
                                                            className="p-1 hover:text-[#EA580C]"
                                                            aria-label="Más"
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                    </div>
                                                    <span className="text-sm font-bold">
                                                        {formatCRC(lineSubtotal(l))}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeLine(l.key)}
                                                className="p-1 text-[#16130F]/30 hover:text-red-500 self-start"
                                                aria-label="Quitar"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}

                                    <div className="pt-2 space-y-1.5 text-sm">
                                        <div className="flex justify-between text-[#16130F]/60">
                                            <span>Subtotal</span>
                                            <span>{formatCRC(totals.subtotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-[#16130F]/60">
                                            <span>IVA ({IVA_PCT}%)</span>
                                            <span>{formatCRC(totals.tax)}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-base pt-1.5 border-t border-[#16130F]/10">
                                            <span>Total</span>
                                            <span className="text-[#EA580C]">
                                                {formatCRC(totals.total)}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-[#16130F]/40 text-right">
                                            {totalPieces} piezas
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Contact */}
                        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
                            <h2 className="font-bold text-lg">Tus datos</h2>
                            <input
                                type="text"
                                value={contact.companyName}
                                onChange={(e) =>
                                    setContact({ ...contact, companyName: e.target.value })
                                }
                                placeholder="Empresa"
                                className="w-full p-2.5 rounded-lg border border-[#16130F]/15 text-sm outline-none focus:border-[#EA580C]"
                            />
                            <input
                                type="text"
                                value={contact.clientName}
                                onChange={(e) =>
                                    setContact({ ...contact, clientName: e.target.value })
                                }
                                placeholder="Tu nombre"
                                className="w-full p-2.5 rounded-lg border border-[#16130F]/15 text-sm outline-none focus:border-[#EA580C]"
                            />
                            <input
                                type="email"
                                value={contact.email}
                                onChange={(e) =>
                                    setContact({ ...contact, email: e.target.value })
                                }
                                placeholder="Correo"
                                className="w-full p-2.5 rounded-lg border border-[#16130F]/15 text-sm outline-none focus:border-[#EA580C]"
                            />
                            <input
                                type="tel"
                                value={contact.phone}
                                onChange={(e) =>
                                    setContact({ ...contact, phone: e.target.value })
                                }
                                placeholder="Teléfono / WhatsApp"
                                className="w-full p-2.5 rounded-lg border border-[#16130F]/15 text-sm outline-none focus:border-[#EA580C]"
                            />
                            <textarea
                                value={contact.notes}
                                onChange={(e) =>
                                    setContact({ ...contact, notes: e.target.value })
                                }
                                rows={2}
                                placeholder="Comentarios (opcional)"
                                className="w-full p-2.5 rounded-lg border border-[#16130F]/15 text-sm outline-none focus:border-[#EA580C]"
                            />

                            {error && (
                                <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2.5">
                                    {error}
                                </p>
                            )}

                            <button
                                onClick={handleSubmit}
                                disabled={submitting || cart.length === 0}
                                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-[#EA580C] text-white rounded-full font-bold hover:bg-[#16130F] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                                {submitting && <Loader2 className="animate-spin" size={16} />}
                                Enviar cotización
                            </button>
                        </div>
                    </aside>
                </div>
            </div>

            {configuring && (
                <ConfigDrawer
                    item={configuring}
                    onClose={() => setConfiguring(null)}
                    onAdd={addToCart}
                />
            )}
        </main>
    );
}

function ConfigDrawer({
    item,
    onClose,
    onAdd
}: {
    item: CatalogItem;
    onClose: () => void;
    onAdd: (line: Omit<CartLine, 'key'>) => void;
}) {
    const fabricChoices =
        item.fabricOptions.length > 0
            ? item.fabricOptions
            : item.fabricType
              ? [item.fabricType]
              : [];
    const [fabric, setFabric] = useState(fabricChoices[0] ?? '');
    const [color, setColor] = useState(item.colorOptions[0]?.name ?? '');
    const [logoCount, setLogoCount] = useState(0);
    const [quantity, setQuantity] = useState(1);

    // Slide-in on mount, slide-out before unmount. `shown` toggles the
    // panel's translate; close/add wait for the transition to finish.
    // A short timeout (not rAF) reliably flips after the initial closed
    // paint even under React StrictMode's dev double-invoke of effects.
    const [shown, setShown] = useState(false);
    useEffect(() => {
        const id = setTimeout(() => setShown(true), 20);
        return () => clearTimeout(id);
    }, []);
    const dismiss = (after: () => void) => {
        setShown(false);
        setTimeout(after, 250);
    };

    // The shown image tracks the selected color — swaps to the image
    // tagged with that color, or the primary image if none matches.
    const shownImage = imageForColor(item, color);

    const linePrice = lineSubtotal({
        unitPrice: item.unitPrice,
        pricePerLogo: item.pricePerLogo,
        logoCount,
        quantity
    });

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
                    shown ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={() => dismiss(onClose)}
            />

            {/* Sidebar panel */}
            <div
                className={`relative h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
                    shown ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                <div className="relative h-56 sm:h-64 bg-[#F1EDE4] shrink-0">
                    {shownImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            key={shownImage}
                            src={shownImage}
                            alt={`${item.name}${color ? ' — ' + color : ''}`}
                            className="w-full h-full object-contain p-2"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon size={40} className="text-[#16130F]/20" />
                        </div>
                    )}
                    <button
                        onClick={() => dismiss(onClose)}
                        className="absolute top-3 right-3 bg-white/90 rounded-full p-2 shadow hover:bg-white"
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <h2 className="text-xl font-bold">{item.name}</h2>
                    {item.description && (
                        <p className="text-sm text-[#16130F]/60 mt-1">{item.description}</p>
                    )}

                    {/* Fabric */}
                    {fabricChoices.length > 0 && (
                        <div className="mt-5">
                            <p className="text-xs font-bold uppercase tracking-wide text-[#16130F]/50 mb-2">
                                Tela
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {fabricChoices.map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setFabric(f)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${
                                            fabric === f
                                                ? 'bg-[#16130F] text-white border-[#16130F]'
                                                : 'bg-white text-[#16130F] border-[#16130F]/20 hover:border-[#16130F]'
                                        }`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Color */}
                    {item.colorOptions.length > 0 && (
                        <div className="mt-5">
                            <p className="text-xs font-bold uppercase tracking-wide text-[#16130F]/50 mb-2">
                                Color{color ? `: ${color}` : ''}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {item.colorOptions.map((c) => (
                                    <button
                                        key={c.name}
                                        onClick={() => setColor(c.name)}
                                        title={c.name}
                                        className={`w-9 h-9 rounded-full border-2 transition-transform ${
                                            color === c.name
                                                ? 'border-[#EA580C] scale-110'
                                                : 'border-black/10 hover:scale-105'
                                        }`}
                                        style={{ backgroundColor: c.hex }}
                                        aria-label={c.name}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Logos */}
                    {item.maxLogos > 0 && (
                        <div className="mt-5">
                            <p className="text-xs font-bold uppercase tracking-wide text-[#16130F]/50 mb-2 flex items-center gap-1.5">
                                <Sticker size={12} /> Logos
                                {item.pricePerLogo > 0 && (
                                    <span className="normal-case tracking-normal text-[#16130F]/40">
                                        (+{formatCRC(item.pricePerLogo)} c/u)
                                    </span>
                                )}
                            </p>
                            <Stepper
                                value={logoCount}
                                min={0}
                                max={item.maxLogos}
                                onChange={setLogoCount}
                            />
                            <p className="text-[11px] text-[#16130F]/40 mt-1">
                                Hasta {item.maxLogos} logo{item.maxLogos === 1 ? '' : 's'}
                            </p>
                        </div>
                    )}

                    {/* Quantity — preset buttons + fine +/- (no typing) */}
                    <div className="mt-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#16130F]/50 mb-2">
                            Cantidad
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {QTY_PRESETS.map((q) => (
                                <button
                                    key={q}
                                    onClick={() => setQuantity(q)}
                                    className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
                                        quantity === q
                                            ? 'bg-[#EA580C] text-white border-[#EA580C]'
                                            : 'bg-white text-[#16130F] border-[#16130F]/20 hover:border-[#16130F]'
                                    }`}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                            <div className="inline-flex items-center border border-[#16130F]/15 rounded-full">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    disabled={quantity <= 1}
                                    className="p-2.5 hover:text-[#EA580C] disabled:opacity-30"
                                    aria-label="Menos"
                                >
                                    <Minus size={16} />
                                </button>
                                <span className="w-16 text-center font-bold">{quantity}</span>
                                <button
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="p-2.5 hover:text-[#EA580C]"
                                    aria-label="Más"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                            <span className="text-[11px] text-[#16130F]/40">
                                o ajustá la cantidad exacta
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-[#16130F]/10 flex items-center justify-between gap-4 shrink-0">
                    <div>
                        <p className="text-[11px] uppercase tracking-wide text-[#16130F]/40">
                            Subtotal
                        </p>
                        <p className="text-xl font-bold text-[#EA580C]">
                            {formatCRC(linePrice)}
                        </p>
                    </div>
                    <button
                        onClick={() =>
                            dismiss(() =>
                                onAdd({
                                    catalogItemId: item.id,
                                    name: item.name,
                                    imageUrl: shownImage,
                                    fabricType: fabric,
                                    color,
                                    unitPrice: item.unitPrice,
                                    pricePerLogo: item.pricePerLogo,
                                    maxLogos: item.maxLogos,
                                    logoCount,
                                    quantity
                                })
                            )
                        }
                        className="inline-flex items-center gap-2 px-6 py-3 bg-[#EA580C] text-white rounded-full font-bold hover:bg-[#16130F] transition-colors"
                    >
                        <Plus size={16} strokeWidth={3} /> Agregar
                    </button>
                </div>
            </div>
        </div>
    );
}

function Stepper({
    value,
    min,
    max,
    onChange
}: {
    value: number;
    min: number;
    max: number;
    onChange: (n: number) => void;
}) {
    const clamp = (n: number) => Math.max(min, Math.min(max, n));
    return (
        <div className="inline-flex items-center border border-[#16130F]/15 rounded-full">
            <button
                onClick={() => onChange(clamp(value - 1))}
                disabled={value <= min}
                className="p-2.5 hover:text-[#EA580C] disabled:opacity-30"
                aria-label="Menos"
            >
                <Minus size={16} />
            </button>
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || min))}
                className="w-16 text-center font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
                onClick={() => onChange(clamp(value + 1))}
                disabled={value >= max}
                className="p-2.5 hover:text-[#EA580C] disabled:opacity-30"
                aria-label="Más"
            >
                <Plus size={16} />
            </button>
        </div>
    );
}
