'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    AlertTriangle,
    Loader2,
    Mic,
    Sparkles,
    Square,
    X
} from 'lucide-react';
import type { ProductInput } from '@/lib/services/products';

// Single-shot product dictation: opens a small modal, records one
// utterance, parses, and prefills the parent's product form via a
// callback. Closes itself afterwards so the existing Product modal can
// take focus.

interface ParsedProduct {
    name: string | null;
    description: string | null;
    productType: 'shirt' | 'pant' | null;
    gender: 'men' | 'women' | 'unisex' | null;
    sizes_men: string[] | null;
    sizes_women: string[] | null;
    sizes_waist: number[] | null;
    sizes_inseam: number[] | null;
    fabricType: string | null;
    codigoCabys: string | null;
    unitPrice: number | null;
    confidence: number;
}

interface Props {
    /** Called when the LLM returned a parse. The parent merges these
     *  into its form state and opens the existing product modal. */
    onPrefill: (patch: Partial<ProductInput>) => void;
    className?: string;
}

type Phase = 'idle' | 'recording' | 'parsing' | 'done';

// Minimal SpeechRecognition typings (same as voice-stock-dictate).
interface SpeechRecognitionLike extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((e: SpeechRecognitionEventLike) => void) | null;
    onend: (() => void) | null;
    onerror: ((e: { error?: string }) => void) | null;
}
interface SpeechRecognitionEventLike {
    resultIndex: number;
    results: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal: boolean }>;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
    if (typeof window === 'undefined') return null;
    return (
        (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
            .SpeechRecognition ||
        (
            window as unknown as {
                webkitSpeechRecognition?: new () => SpeechRecognitionLike;
            }
        ).webkitSpeechRecognition ||
        null
    );
}

/**
 * Map the ParsedProduct shape (nullable fields) to the partial
 * ProductInput the existing form modal consumes. Null/empty values are
 * omitted so they don't overwrite anything pre-existing.
 */
function toPrefill(p: ParsedProduct): Partial<ProductInput> {
    const out: Partial<ProductInput> = {};
    if (p.name) out.name = p.name;
    if (p.description) out.description = p.description;
    if (p.productType) out.productType = p.productType;
    if (p.gender) out.gender = p.gender;
    if (p.fabricType) out.fabricType = p.fabricType;
    if (p.codigoCabys) out.codigoCabys = p.codigoCabys;
    if (p.unitPrice != null) {
        // ProductInput in products.ts may or may not have unitPrice
        // depending on how the form is wired. We attach it under the
        // same key the form reads; if not consumed it's a harmless extra.
        (out as Partial<ProductInput> & { unitPrice?: number }).unitPrice = p.unitPrice;
    }
    // Sizes get merged into the existing sizes object — only the
    // sub-keys the LLM filled. The form clears defaults before merging.
    const sizes: ProductInput['sizes'] = {};
    if (p.sizes_men) sizes.men = p.sizes_men;
    if (p.sizes_women) sizes.women = p.sizes_women;
    if (p.sizes_waist) sizes.waist = p.sizes_waist;
    if (p.sizes_inseam) sizes.inseam = p.sizes_inseam;
    if (Object.keys(sizes).length > 0) out.sizes = sizes;
    return out;
}

export function VoiceProductDictate({ onPrefill, className = '' }: Props) {
    const [open, setOpen] = useState(false);
    const [phase, setPhase] = useState<Phase>('idle');
    const [interim, setInterim] = useState('');
    const finalBufRef = useRef('');
    const userStoppedRef = useRef(false);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const [parsed, setParsed] = useState<ParsedProduct | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isIOS =
        typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

    const reset = () => {
        recognitionRef.current?.abort();
        recognitionRef.current = null;
        userStoppedRef.current = false;
        finalBufRef.current = '';
        setInterim('');
        setParsed(null);
        setError(null);
        setPhase('idle');
    };
    const close = () => {
        reset();
        setOpen(false);
    };

    useEffect(() => {
        if (!open) recognitionRef.current?.abort();
    }, [open]);

    const startRecording = useCallback(() => {
        setError(null);
        const Ctor = getRecognitionCtor();
        if (!Ctor) {
            setError(
                'Tu navegador no soporta dictado nativo. Usá Chrome de escritorio o Safari macOS.'
            );
            return;
        }
        if (typeof window !== 'undefined' && !window.isSecureContext) {
            setError('Dictado requiere HTTPS o localhost.');
            return;
        }
        userStoppedRef.current = false;
        finalBufRef.current = '';
        setInterim('');

        const r = new Ctor();
        r.continuous = !isIOS;
        r.interimResults = true;
        r.lang = 'es-CR';

        r.onresult = (e) => {
            let interimText = '';
            let finalText = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const res = e.results[i];
                const t = res?.[0]?.transcript ?? '';
                if (!t) continue;
                if (res.isFinal) finalText += t;
                else interimText += t;
            }
            if (finalText) finalBufRef.current += finalText;
            setInterim(interimText);
        };
        r.onend = () => {
            if (!userStoppedRef.current && isIOS) {
                try {
                    r.start();
                } catch {
                    /* swallow */
                }
            }
        };
        r.onerror = (e) => {
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                userStoppedRef.current = true;
                setError('Permiso de micrófono denegado.');
                setPhase('idle');
            } else if (e.error === 'network') {
                userStoppedRef.current = true;
                setError('Error de red en el reconocimiento de voz.');
                setPhase('idle');
            }
        };

        recognitionRef.current = r;
        try {
            r.start();
            setPhase('recording');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo iniciar el dictado.');
        }
    }, [isIOS]);

    const stopAndParse = useCallback(async () => {
        userStoppedRef.current = true;
        recognitionRef.current?.stop();
        await new Promise((r) => setTimeout(r, 200));
        const transcript = (finalBufRef.current + ' ' + interim).trim();
        recognitionRef.current = null;
        if (!transcript) {
            setError('No escuché nada. Intentá de nuevo.');
            setPhase('idle');
            return;
        }
        setPhase('parsing');
        try {
            const res = await fetch('/api/admin/products/voice-parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript })
            });
            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                throw new Error(data?.error || `HTTP ${res.status}`);
            }
            const data = (await res.json()) as { product: ParsedProduct };
            setParsed(data.product);
            setPhase('done');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al procesar el dictado.');
            setPhase('idle');
        }
    }, [interim]);

    const accept = () => {
        if (!parsed) return;
        const patch = toPrefill(parsed);
        if (Object.keys(patch).length === 0) {
            setError('No detecté ningún campo. Intentá ser más específico.');
            return;
        }
        onPrefill(patch);
        close();
    };

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    reset();
                    setOpen(true);
                }}
                title="Crear producto por voz"
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-700/60 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 font-semibold text-sm shadow-sm ${className}`}
            >
                <Mic size={16} />
                Crear por voz
            </button>

            {open && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-2xl shadow-2xl w-full max-w-xl">
                        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Sparkles size={18} className="text-orange-500" />
                                    Crear producto por voz
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    Dictá los datos del producto y revisalos en el formulario.
                                </p>
                            </div>
                            <button
                                onClick={close}
                                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                                aria-label="Cerrar"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    {phase === 'recording' ? (
                                        <button
                                            type="button"
                                            onClick={stopAndParse}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold shadow-md"
                                        >
                                            <Square size={16} />
                                            Detener
                                        </button>
                                    ) : phase === 'parsing' ? (
                                        <button
                                            type="button"
                                            disabled
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-500 font-bold"
                                        >
                                            <Loader2 size={16} className="animate-spin" />
                                            Analizando…
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={startRecording}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md"
                                        >
                                            <Mic size={16} />
                                            {phase === 'idle'
                                                ? 'Empezar a dictar'
                                                : 'Volver a dictar'}
                                        </button>
                                    )}
                                    {phase === 'recording' && (
                                        <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 font-semibold">
                                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                            Grabando…
                                        </span>
                                    )}
                                </div>

                                <div className="text-sm text-zinc-700 dark:text-zinc-200 min-h-[3rem] whitespace-pre-wrap leading-relaxed">
                                    {finalBufRef.current ||
                                    interim ||
                                    (phase === 'idle' ? (
                                        <em className="text-zinc-400 dark:text-zinc-500">
                                            Ejemplo: &ldquo;Crear Camisa Polo Roja, mujer, tela algodón,
                                            tallas S a XL, código CABYS seis dos cero uno cero cero cero
                                            cero cero cero cero cero cero, precio doce mil
                                            quinientos&rdquo;.
                                        </em>
                                    ) : (
                                        ''
                                    ))}
                                    {interim && (
                                        <span className="text-zinc-400 dark:text-zinc-500"> {interim}</span>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300 p-3 rounded-lg text-sm flex items-start gap-2">
                                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                    {error}
                                </div>
                            )}

                            {phase === 'done' && parsed && (
                                <Preview parsed={parsed} onAccept={accept} onCancel={close} />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function Preview({
    parsed,
    onAccept,
    onCancel
}: {
    parsed: ParsedProduct;
    onAccept: () => void;
    onCancel: () => void;
}) {
    const low = parsed.confidence < 0.7;
    const rows: { label: string; value: string }[] = [
        { label: 'Nombre', value: parsed.name || '—' },
        {
            label: 'Tipo',
            value: parsed.productType
                ? parsed.productType === 'shirt'
                    ? 'Camisa'
                    : 'Pantalón'
                : '—'
        },
        {
            label: 'Género',
            value:
                parsed.gender === 'men'
                    ? 'Hombre'
                    : parsed.gender === 'women'
                      ? 'Mujer'
                      : parsed.gender === 'unisex'
                        ? 'Unisex'
                        : '—'
        },
        { label: 'Tela', value: parsed.fabricType || '—' },
        {
            label: 'Tallas',
            value:
                [
                    parsed.sizes_men && parsed.sizes_men.length
                        ? `H: ${parsed.sizes_men.join(', ')}`
                        : null,
                    parsed.sizes_women && parsed.sizes_women.length
                        ? `M: ${parsed.sizes_women.join(', ')}`
                        : null,
                    parsed.sizes_waist && parsed.sizes_waist.length
                        ? `Cintura: ${parsed.sizes_waist.join(', ')}`
                        : null,
                    parsed.sizes_inseam && parsed.sizes_inseam.length
                        ? `Largo: ${parsed.sizes_inseam.join(', ')}`
                        : null
                ]
                    .filter(Boolean)
                    .join(' · ') || '—'
        },
        { label: 'CABYS', value: parsed.codigoCabys || '—' },
        {
            label: 'Precio',
            value:
                parsed.unitPrice != null
                    ? new Intl.NumberFormat('es-CR', {
                          style: 'currency',
                          currency: 'CRC',
                          maximumFractionDigits: 0
                      }).format(parsed.unitPrice)
                    : '—'
        }
    ];

    return (
        <div className="space-y-3">
            <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                Campos detectados
                {low && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
                        Confianza {Math.round(parsed.confidence * 100)}%
                    </span>
                )}
            </h4>
            <dl className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                {rows.map((r) => (
                    <div
                        key={r.label}
                        className="grid grid-cols-[140px,1fr] gap-2 px-3 py-2 bg-white dark:bg-zinc-900"
                    >
                        <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 font-semibold self-center">
                            {r.label}
                        </dt>
                        <dd
                            className={
                                r.value === '—'
                                    ? 'text-zinc-400 dark:text-zinc-500'
                                    : 'text-zinc-900 dark:text-zinc-100 font-medium'
                            }
                        >
                            {r.value}
                        </dd>
                    </div>
                ))}
            </dl>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
                Vas a poder editar todo en el formulario antes de guardar. Los campos no
                detectados quedan vacíos.
            </p>
            <div className="flex justify-end gap-2 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-semibold"
                >
                    Descartar
                </button>
                <button
                    type="button"
                    onClick={onAccept}
                    className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md"
                >
                    Abrir formulario con estos datos
                </button>
            </div>
        </div>
    );
}
