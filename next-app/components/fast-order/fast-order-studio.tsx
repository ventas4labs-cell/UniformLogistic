'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useDialog } from '@/lib/use-dialog';
import {
    ArrowLeft,
    ShoppingBag,
    Plus,
    Trash2,
    Loader2,
    ImageIcon,
    PartyPopper
} from 'lucide-react';
import type { Product, SizeSelection } from '@/lib/types';
import { SizeSelector } from '@/components/size-selector';
import { submitFastOrderAction } from '@/app/ordenar/actions';
import type { FastOrderItem } from '@/lib/services/fast-orders';

// A basic product with its DB uuid (needed to link the eventual order).
type FastOrderProduct = Product & { uuid: string };

// Pure, dependency-free copy of selectionToSizeString so this client
// component doesn't pull the orders service into the browser bundle.
function sizeLabel(sel: SizeSelection): string {
    if (sel.waist) {
        return sel.inseam ? `C${sel.waist}" / L${sel.inseam}"` : `C${sel.waist}"`;
    }
    const g = sel.gender ? (sel.gender === 'Men' ? 'Hombre · ' : 'Mujer · ') : '';
    return `${g}${sel.size || ''}`.trim();
}

const IVORY = '#F7F4EE';
const ORANGE = '#EA580C';

export function FastOrderStudio({ products }: { products: FastOrderProduct[] }) {
    const [cart, setCart] = useState<FastOrderItem[]>([]);
    const [step, setStep] = useState<'catalog' | 'contact' | 'done'>('catalog');

    // Per-product config modal state.
    const [configuring, setConfiguring] = useState<FastOrderProduct | null>(null);
    const [configPhase, setConfigPhase] = useState<'color' | 'size'>('color');
    const [configColor, setConfigColor] = useState('');

    // Contact form.
    const [contact, setContact] = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        notes: ''
    });
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [requestRef, setRequestRef] = useState('');

    const totalPieces = cart.reduce((s, i) => s + i.quantity, 0);

    const openConfig = (product: FastOrderProduct) => {
        setConfiguring(product);
        setConfigColor(product.colors?.[0]?.name ?? '');
        setConfigPhase('color');
    };

    const closeConfig = () => setConfiguring(null);

    const handleSizesAdded = (
        lines: { selection: SizeSelection; quantity: number }[]
    ) => {
        if (!configuring) return;
        const p = configuring;
        const newItems: FastOrderItem[] = lines.map((l) => ({
            productId: p.uuid,
            productCode: p.id,
            productName: p.name,
            size: sizeLabel(l.selection),
            color: configColor.trim(),
            quantity: l.quantity,
            selection: l.selection
        }));
        setCart((prev) => [...prev, ...newItems]);
        setConfiguring(null);
    };

    const removeItem = (idx: number) =>
        setCart((prev) => prev.filter((_, i) => i !== idx));

    const submit = () => {
        if (pending) return;
        setError(null);
        if (!contact.name.trim()) {
            setError('Ingresá tu nombre.');
            return;
        }
        if (!contact.email.trim() && !contact.phone.trim()) {
            setError('Dejanos un correo o teléfono para poder contactarte.');
            return;
        }
        startTransition(async () => {
            const res = await submitFastOrderAction(contact, cart);
            if (!res.ok) {
                setError(res.error || 'No pudimos enviar tu pedido.');
                return;
            }
            setRequestRef(res.requestRef || '');
            setStep('done');
        });
    };

    const reset = () => {
        setCart([]);
        setContact({ name: '', email: '', phone: '', company: '', notes: '' });
        setRequestRef('');
        setError(null);
        setStep('catalog');
    };

    // ── Thank-you screen ─────────────────────────────────────────────
    if (step === 'done') {
        return (
            <main
                className="min-h-screen flex items-center justify-center p-6"
                style={{ background: IVORY, color: '#16130F' }}
            >
                <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-black/5 p-8 text-center">
                    <div
                        className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center text-white"
                        style={{ background: ORANGE }}
                    >
                        <PartyPopper size={30} />
                    </div>
                    <h1 className="text-2xl font-extrabold mb-2">
                        ¡Gracias por tu pedido!
                    </h1>
                    <p className="text-black/60 leading-relaxed">
                        Recibimos tu solicitud
                        {requestRef ? (
                            <>
                                {' '}
                                <span className="font-bold" style={{ color: ORANGE }}>
                                    {requestRef}
                                </span>
                            </>
                        ) : null}
                        . Nuestro equipo te contactará muy pronto para confirmar los
                        detalles.
                    </p>
                    <button
                        onClick={reset}
                        className="mt-7 w-full py-3 rounded-xl font-bold text-white"
                        style={{ background: ORANGE }}
                    >
                        Hacer otro pedido
                    </button>
                    <Link
                        href="/"
                        className="mt-3 inline-block text-sm font-semibold text-black/60 hover:text-black"
                    >
                        Volver al inicio
                    </Link>
                </div>
            </main>
        );
    }

    // ── Contact step ─────────────────────────────────────────────────
    if (step === 'contact') {
        return (
            <main
                className="min-h-screen py-10 px-6"
                style={{ background: IVORY, color: '#16130F' }}
            >
                <div className="mx-auto max-w-lg">
                    <button
                        onClick={() => setStep('catalog')}
                        className="inline-flex items-center gap-2 text-sm font-bold text-black/60 hover:text-black mb-6"
                    >
                        <ArrowLeft size={16} /> Volver a los productos
                    </button>
                    <h1 className="text-3xl font-extrabold tracking-tight mb-1">
                        Tus datos de contacto
                    </h1>
                    <p className="text-black/60 mb-6">
                        Dejanos cómo contactarte y nos comunicamos para confirmar tu
                        pedido.
                    </p>

                    {/* Order summary */}
                    <div className="bg-white rounded-2xl border border-black/5 p-4 mb-5">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-bold">Tu pedido</h2>
                            <span
                                className="text-sm font-bold"
                                style={{ color: ORANGE }}
                            >
                                {totalPieces} {totalPieces === 1 ? 'pieza' : 'piezas'}
                            </span>
                        </div>
                        <ul className="divide-y divide-black/5">
                            {cart.map((it, idx) => (
                                <li
                                    key={idx}
                                    className="py-2 flex items-center justify-between gap-3 text-sm"
                                >
                                    <div className="min-w-0">
                                        <p className="font-semibold truncate">
                                            {it.productName}
                                        </p>
                                        <p className="text-black/60 text-xs">
                                            {[it.size, it.color]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                    </div>
                                    <span className="font-mono font-bold bg-black/5 px-2 py-0.5 rounded shrink-0">
                                        ×{it.quantity}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-white rounded-2xl border border-black/5 p-5 space-y-3">
                        <Field
                            label="Nombre *"
                            value={contact.name}
                            onChange={(v) => setContact({ ...contact, name: v })}
                            placeholder="Tu nombre"
                        />
                        <div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field
                                    label="Correo"
                                    type="email"
                                    value={contact.email}
                                    onChange={(v) => setContact({ ...contact, email: v })}
                                    placeholder="tu@correo.com"
                                />
                                <Field
                                    label="Teléfono"
                                    type="tel"
                                    value={contact.phone}
                                    onChange={(v) => setContact({ ...contact, phone: v })}
                                    placeholder="8888-8888"
                                />
                            </div>
                            <p className="mt-1.5 text-xs text-black/60">
                                Dejanos al menos un correo o un teléfono para poder
                                contactarte.
                            </p>
                        </div>
                        <Field
                            label="Empresa (opcional)"
                            value={contact.company}
                            onChange={(v) => setContact({ ...contact, company: v })}
                            placeholder="Nombre de tu empresa"
                        />
                        <div>
                            <label className="block text-xs font-bold text-black/60 mb-1">
                                Notas (opcional)
                            </label>
                            <textarea
                                value={contact.notes}
                                onChange={(e) =>
                                    setContact({ ...contact, notes: e.target.value })
                                }
                                placeholder="Fecha deseada, detalles, etc."
                                className="w-full p-3 rounded-xl border border-black/15 bg-white outline-none focus:border-orange-500 h-20 text-sm"
                            />
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm border border-red-100">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={submit}
                            disabled={pending}
                            className="w-full py-3.5 rounded-xl font-extrabold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                            style={{ background: ORANGE }}
                        >
                            {pending ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Enviando…
                                </>
                            ) : (
                                'Enviar pedido'
                            )}
                        </button>
                        <p className="text-xs text-black/60 text-center">
                            Al enviar, nuestro equipo revisará tu pedido y te
                            contactará. No es un cobro.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    // ── Catalog step ─────────────────────────────────────────────────
    return (
        <main className="min-h-screen" style={{ background: IVORY, color: '#16130F' }}>
            <header className="sticky top-0 z-30 bg-[#F7F4EE]/90 backdrop-blur border-b border-black/10">
                <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 font-bold text-sm hover:text-[#EA580C] transition-colors"
                    >
                        <ArrowLeft size={16} /> Uniform Logistic
                    </Link>
                    <div className="flex items-center gap-2 text-sm font-bold text-black/70">
                        <ShoppingBag size={16} style={{ color: ORANGE }} />
                        {totalPieces} {totalPieces === 1 ? 'pieza' : 'piezas'}
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-6xl px-6 py-10 pb-28 lg:pb-10">
                <div className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                        Hacé tu pedido
                    </h1>
                    <p className="text-black/60 mt-2 max-w-xl">
                        Elegí el producto, la talla, el color y la cantidad. Cuando
                        termines, dejanos tus datos y te contactamos para confirmar.
                    </p>
                </div>

                {products.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-black/60">
                        No hay productos disponibles en este momento.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-8 items-start">
                        {/* Product grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {products.map((p) => (
                                <button
                                    key={p.uuid}
                                    onClick={() => openConfig(p)}
                                    className="group text-left bg-white rounded-2xl border border-black/5 overflow-hidden hover:shadow-lg hover:border-orange-200 transition-all"
                                >
                                    <div className="aspect-square bg-zinc-100 flex items-center justify-center overflow-hidden">
                                        {p.image ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={p.image}
                                                alt={p.name}
                                                loading="lazy"
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <ImageIcon
                                                size={32}
                                                className="text-zinc-300"
                                            />
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <p className="font-bold text-sm leading-tight line-clamp-2">
                                            {p.name}
                                        </p>
                                        {p.colors && p.colors.length > 0 && (
                                            <div className="flex items-center gap-1 mt-2">
                                                {p.colors.slice(0, 6).map((c) => (
                                                    <span
                                                        key={c.name}
                                                        title={c.name}
                                                        className="w-3.5 h-3.5 rounded-full border border-black/10"
                                                        style={{ background: c.hex }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        <span
                                            className="mt-2 inline-flex items-center gap-1 text-xs font-bold"
                                            style={{ color: ORANGE }}
                                        >
                                            <Plus size={13} /> Agregar
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Cart — side panel on desktop, below the grid on
                            mobile (the sticky bottom bar jumps here). */}
                        <aside id="fast-order-cart" className="lg:sticky lg:top-20 scroll-mt-20">
                            <div className="bg-white rounded-2xl border border-black/5 p-5">
                                <h2 className="font-bold mb-3">Tu pedido</h2>
                                {cart.length === 0 ? (
                                    <p className="text-sm text-black/60 py-6 text-center">
                                        Todavía no agregaste productos.
                                    </p>
                                ) : (
                                    <ul className="divide-y divide-black/5 mb-4">
                                        {cart.map((it, idx) => (
                                            <li
                                                key={idx}
                                                className="py-2.5 flex items-center gap-3"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-sm truncate">
                                                        {it.productName}
                                                    </p>
                                                    <p className="text-black/60 text-xs">
                                                        {[it.size, it.color]
                                                            .filter(Boolean)
                                                            .join(' · ')}{' '}
                                                        · ×{it.quantity}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => removeItem(idx)}
                                                    className="text-black/40 hover:text-red-600 shrink-0"
                                                    aria-label="Quitar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <button
                                    onClick={() => setStep('contact')}
                                    disabled={cart.length === 0}
                                    className="w-full py-3 rounded-xl font-extrabold text-white flex items-center justify-center gap-2 disabled:bg-zinc-300"
                                    style={
                                        cart.length > 0 ? { background: ORANGE } : undefined
                                    }
                                >
                                    Continuar
                                </button>
                            </div>
                        </aside>
                    </div>
                )}
            </div>

            {/* Sticky mobile checkout bar — the desktop side cart sits below
                the grid on phones, so surface progress + Continuar as soon
                as something is in the cart. */}
            {cart.length > 0 && (
                <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-black/10 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                    <div className="flex items-center gap-3 max-w-lg mx-auto">
                        <a
                            href="#fast-order-cart"
                            className="text-sm font-bold text-black/70 whitespace-nowrap"
                        >
                            {totalPieces} {totalPieces === 1 ? 'pieza' : 'piezas'}
                        </a>
                        <button
                            onClick={() => setStep('contact')}
                            className="flex-1 py-3 rounded-xl font-extrabold text-white"
                            style={{ background: ORANGE }}
                        >
                            Continuar
                        </button>
                    </div>
                </div>
            )}

            {/* Per-product config: colour → sizes */}
            {configuring && configPhase === 'color' && (
                <ColorPhase
                    product={configuring}
                    color={configColor}
                    setColor={setConfigColor}
                    onCancel={closeConfig}
                    onContinue={() => setConfigPhase('size')}
                />
            )}
            {configuring && configPhase === 'size' && (
                <SizeSelector
                    product={configuring}
                    onAdd={handleSizesAdded}
                    onCancel={closeConfig}
                />
            )}
        </main>
    );
}

// ── Colour picker (first phase of the per-product modal) ─────────────
function ColorPhase({
    product,
    color,
    setColor,
    onCancel,
    onContinue
}: {
    product: FastOrderProduct;
    color: string;
    setColor: (c: string) => void;
    onCancel: () => void;
    onContinue: () => void;
}) {
    const colors = product.colors ?? [];
    const hasSwatches = colors.length > 0;
    // Require a choice only when the product defines colours.
    const canContinue = !hasSwatches || color.trim().length > 0;

    // Dialog semantics: focus moves into the modal on open, Escape closes.
    const dialogRef = useDialog(onCancel);

    // Picture follows the selected swatch when that colour has its own
    // photo; otherwise the primary product image. Until the new file's
    // onLoad fires the frame keeps its size and shows a spinner instead
    // of a blank flash (the <img> is key-remounted per src). onError
    // settles too so a broken URL can't spin forever.
    const selected = colors.find((c) => c.name === color);
    const shownImage = selected?.imageUrl || product.image;
    const [readySrc, setReadySrc] = useState<string | null>(null);
    const imgReady = readySrc === shownImage;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
            onClick={onCancel}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={`Elegí el color — ${product.name}`}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl outline-none">
                <div className="flex justify-between items-start mb-5">
                    <div>
                        <h3 className="text-xl font-extrabold text-zinc-900">
                            {product.name}
                        </h3>
                        <p className="text-sm text-zinc-500">Elegí el color</p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-zinc-500 hover:text-zinc-900 text-2xl leading-none"
                        aria-label="Cerrar"
                    >
                        &times;
                    </button>
                </div>

                {shownImage && (
                    <div className="relative mx-auto mb-5 w-40 aspect-square rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            key={shownImage}
                            src={shownImage}
                            alt={`${product.name}${color ? ' — ' + color : ''}`}
                            onLoad={() => setReadySrc(shownImage)}
                            onError={() => setReadySrc(shownImage)}
                            className={`w-full h-full object-contain transition-opacity duration-200 ${
                                imgReady ? 'opacity-100' : 'opacity-0'
                            }`}
                        />
                        {!imgReady && (
                            <div
                                className="absolute inset-0 flex items-center justify-center"
                                aria-hidden="true"
                            >
                                <Loader2
                                    size={22}
                                    className="animate-spin text-zinc-400"
                                />
                            </div>
                        )}
                    </div>
                )}

                {hasSwatches ? (
                    <div className="flex flex-wrap gap-2.5 justify-center mb-6">
                        {colors.map((c) => {
                            const active = c.name === color;
                            return (
                                <button
                                    key={c.name}
                                    onClick={() => setColor(c.name)}
                                    className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${
                                        active
                                            ? 'border-orange-500 bg-orange-50'
                                            : 'border-transparent hover:bg-zinc-50'
                                    }`}
                                >
                                    <span
                                        className="w-9 h-9 rounded-full border border-black/10"
                                        style={{ background: c.hex }}
                                    />
                                    <span className="text-[11px] font-semibold text-zinc-700 max-w-16 truncate">
                                        {c.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-zinc-600 mb-1">
                            Color deseado (opcional)
                        </label>
                        <input
                            type="text"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            placeholder="Ej. Azul marino"
                            className="w-full p-3 rounded-xl border border-black/15 outline-none focus:border-orange-500 text-sm"
                        />
                    </div>
                )}

                <button
                    onClick={onContinue}
                    disabled={!canContinue}
                    className="w-full py-3.5 rounded-xl font-extrabold text-white disabled:bg-zinc-300"
                    style={canContinue ? { background: ORANGE } : undefined}
                >
                    Continuar a tallas
                </button>
            </div>
        </div>
    );
}

// ── Small labelled input ─────────────────────────────────────────────
function Field({
    label,
    value,
    onChange,
    placeholder,
    type = 'text'
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
}) {
    return (
        <div>
            <label className="block text-xs font-bold text-black/60 mb-1">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full p-3 rounded-xl border border-black/15 bg-white outline-none focus:border-orange-500 text-sm"
            />
        </div>
    );
}
