'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    CheckCircle2,
    Loader2,
    Mic,
    MicOff,
    Save,
    Sparkles,
    Square,
    Trash2,
    X
} from 'lucide-react';

// Voice dictation flow:
//   idle  →  recording  →  parsing  →  review  →  applying  →  done
// State machine kept inside this component. Network calls are POSTs to
// /api/admin/stock/voice-parse and voice-apply.

interface CompanyOption {
    id: string;
    name: string;
}

type MovementType = 'entry' | 'exit' | 'reserve' | 'release' | 'adjustment';

const MOVEMENT_TYPES: { value: MovementType; label: string; verbHint: string; cls: string }[] = [
    {
        value: 'entry',
        label: 'Entrada',
        verbHint: 'recibí',
        cls: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
    },
    {
        value: 'exit',
        label: 'Salida',
        verbHint: 'despaché',
        cls: 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300'
    },
    {
        value: 'reserve',
        label: 'Reserva',
        verbHint: 'aparté',
        cls: 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300'
    },
    {
        value: 'release',
        label: 'Liberar',
        verbHint: 'liberé',
        cls: 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
    },
    {
        value: 'adjustment',
        label: 'Ajuste',
        verbHint: 'el conteo es',
        cls: 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300'
    }
];

function typeMeta(type: MovementType) {
    return MOVEMENT_TYPES.find((t) => t.value === type) ?? MOVEMENT_TYPES[0];
}

interface ParsedCommand {
    product_id: string;
    product_name: string;
    product_code: string;
    size: string;
    company_stock_id: string | null;
    type: MovementType;
    quantity: number;
    reason: string;
    confidence: number;
}

interface UnmatchedMention {
    raw: string;
    quantity: number | null;
    unit: string | null;
}

interface ParseResponse {
    transcript: string;
    commands: ParsedCommand[];
    unmatched: UnmatchedMention[];
    warning: string | null;
}

interface ApplyResultRow extends ParsedCommand {
    ok: boolean;
    error?: string;
    new_on_hand?: number;
    new_reserved?: number;
    noop?: boolean;
}

interface Props {
    companies: CompanyOption[];
    /** Optional preselected company (the admin's current filter context). */
    defaultCompanyId?: string;
    className?: string;
}

type Phase = 'idle' | 'recording' | 'parsing' | 'review' | 'applying' | 'done';

// Minimal SpeechRecognition typings — the DOM lib types only ship in
// some TS-DOM versions, and we don't want a runtime dependency.
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

export function VoiceStockDictate({ companies, defaultCompanyId, className = '' }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [phase, setPhase] = useState<Phase>('idle');
    const [companyId, setCompanyId] = useState(
        defaultCompanyId || companies[0]?.id || ''
    );

    const [interim, setInterim] = useState('');
    const finalBufRef = useRef('');
    const userStoppedRef = useRef(false);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

    const [parsed, setParsed] = useState<ParseResponse | null>(null);
    const [edited, setEdited] = useState<ParsedCommand[]>([]);
    const [results, setResults] = useState<ApplyResultRow[]>([]);
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
        setEdited([]);
        setResults([]);
        setError(null);
        setPhase('idle');
    };

    const close = () => {
        reset();
        setOpen(false);
    };

    // Stop recognition cleanly on unmount / modal close
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
        if (!companyId) {
            setError('Seleccioná una empresa primero.');
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
                    /* swallow — Safari throws if already started */
                }
            }
        };
        r.onerror = (e) => {
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                userStoppedRef.current = true;
                setError(
                    'Permiso de micrófono denegado. Habilitalo en los ajustes del navegador.'
                );
                setPhase('idle');
            } else if (e.error === 'network') {
                userStoppedRef.current = true;
                setError('Error de red en el reconocimiento de voz. Reintentá.');
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
    }, [companyId, isIOS]);

    const stopAndParse = useCallback(async () => {
        userStoppedRef.current = true;
        recognitionRef.current?.stop();
        // Let iOS flush trailing interim words.
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
            const res = await fetch('/api/admin/stock/voice-parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript, company_id: companyId })
            });
            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                throw new Error(data?.error || `HTTP ${res.status}`);
            }
            const data = (await res.json()) as ParseResponse;
            setParsed(data);
            setEdited(data.commands);
            setPhase('review');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al procesar el dictado.');
            setPhase('idle');
        }
    }, [companyId, interim]);

    const apply = useCallback(async () => {
        if (!parsed || edited.length === 0) return;
        setPhase('applying');
        try {
            const res = await fetch('/api/admin/stock/voice-apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company_id: companyId,
                    transcript: parsed.transcript,
                    parsed_commands: parsed.commands,
                    commands: edited
                })
            });
            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                throw new Error(data?.error || `HTTP ${res.status}`);
            }
            const data = (await res.json()) as { results: ApplyResultRow[] };
            setResults(data.results);
            setPhase('done');
            // Refresh server data so the /admin/stock board reflects new
            // on-hand counts when the modal closes.
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al aplicar.');
            setPhase('review');
        }
    }, [companyId, edited, parsed, router]);

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    reset();
                    setOpen(true);
                }}
                title="Dictar entradas de stock"
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-orange-300 dark:border-orange-700/60 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 font-semibold text-sm shadow-sm ${className}`}
            >
                <Mic size={16} />
                Dictar stock
            </button>

            {open && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Sparkles size={18} className="text-orange-500" />
                                    Dictado de stock
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    Dictá lo que recibís y revisalo antes de aplicar al inventario.
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
                            {/* Company picker */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1.5">
                                    Empresa receptora
                                </label>
                                <select
                                    value={companyId}
                                    onChange={(e) => setCompanyId(e.target.value)}
                                    disabled={phase !== 'idle'}
                                    className="w-full p-2.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg font-semibold disabled:opacity-60"
                                >
                                    {companies.length === 0 ? (
                                        <option value="">(sin empresas)</option>
                                    ) : (
                                        companies.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {/* Transcript area + mic control */}
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
                                    ) : phase === 'parsing' || phase === 'applying' ? (
                                        <button
                                            type="button"
                                            disabled
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-500 font-bold"
                                        >
                                            <Loader2 size={16} className="animate-spin" />
                                            {phase === 'parsing' ? 'Analizando…' : 'Aplicando…'}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={startRecording}
                                            disabled={!companyId}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold shadow-md"
                                        >
                                            <Mic size={16} />
                                            {phase === 'idle' ? 'Empezar a dictar' : 'Volver a dictar'}
                                        </button>
                                    )}
                                    {phase === 'recording' && (
                                        <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 font-semibold">
                                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                            Grabando…
                                        </span>
                                    )}
                                </div>

                                <div className="text-sm text-zinc-700 dark:text-zinc-200 min-h-[3.5rem] whitespace-pre-wrap leading-relaxed">
                                    {finalBufRef.current ||
                                    interim ||
                                    (phase === 'idle' ? (
                                        <div className="text-zinc-400 dark:text-zinc-500 text-xs space-y-1">
                                            <div>
                                                <strong>Entrada:</strong> &ldquo;Recibí 20 Cargo Verde
                                                cintura 32&rdquo;
                                            </div>
                                            <div>
                                                <strong>Salida:</strong> &ldquo;Despaché 5 Camisa Azul
                                                hombre talla M&rdquo;
                                            </div>
                                            <div>
                                                <strong>Reserva:</strong> &ldquo;Aparté 3 Cargo Verde
                                                cintura 34 para la orden mil&rdquo;
                                            </div>
                                            <div>
                                                <strong>Ajuste:</strong> &ldquo;El conteo de Camisa
                                                Reflectiva mujer talla L es 8&rdquo;
                                            </div>
                                        </div>
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

                            {parsed?.warning && (
                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 p-3 rounded-lg text-sm flex items-start gap-2">
                                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                    {parsed.warning}
                                </div>
                            )}

                            {/* Review */}
                            {phase === 'review' && parsed && (
                                <ReviewTable
                                    catalog={parsed.commands}
                                    edited={edited}
                                    onChange={setEdited}
                                    unmatched={parsed.unmatched}
                                    onApply={apply}
                                />
                            )}

                            {/* Apply results */}
                            {phase === 'done' && (
                                <ApplyResults results={results} onClose={close} />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ── Subcomponents ───────────────────────────────────────────────────────

function ReviewTable({
    catalog,
    edited,
    onChange,
    unmatched,
    onApply
}: {
    catalog: ParsedCommand[];
    edited: ParsedCommand[];
    onChange: (rows: ParsedCommand[]) => void;
    unmatched: UnmatchedMention[];
    onApply: () => void;
}) {
    const update = (idx: number, patch: Partial<ParsedCommand>) => {
        onChange(edited.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
    };
    const remove = (idx: number) => {
        onChange(edited.filter((_, i) => i !== idx));
    };

    if (edited.length === 0 && unmatched.length === 0) {
        return (
            <div className="text-center py-6 text-zinc-500 dark:text-zinc-400 text-sm">
                No detecté movimientos. Volvé a dictar.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div>
                <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                    {edited.length} movimiento{edited.length === 1 ? '' : 's'} detectado
                    {edited.length === 1 ? '' : 's'}
                </h4>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                            <tr>
                                <th className="p-2 text-left">Producto</th>
                                <th className="p-2 text-left w-28">Tipo</th>
                                <th className="p-2 text-left">Talla</th>
                                <th className="p-2 text-right w-24">Cantidad</th>
                                <th className="p-2 text-left">Motivo</th>
                                <th className="p-2 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {edited.map((cmd, idx) => {
                                const low = cmd.confidence < 0.7;
                                const meta = typeMeta(cmd.type);
                                const isAdjustment = cmd.type === 'adjustment';
                                return (
                                    <tr
                                        key={idx}
                                        className={
                                            low
                                                ? 'bg-amber-50 dark:bg-amber-950/20'
                                                : 'bg-white dark:bg-zinc-900'
                                        }
                                    >
                                        <td className="p-2">
                                            <div className="font-semibold">{cmd.product_name}</div>
                                            <div className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                                                {cmd.product_code}
                                            </div>
                                            {low && (
                                                <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                                                    Confianza {Math.round(cmd.confidence * 100)}% — revisá
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-2">
                                            <select
                                                value={cmd.type}
                                                onChange={(e) =>
                                                    update(idx, {
                                                        type: e.target.value as MovementType
                                                    })
                                                }
                                                className={`w-full p-1 rounded text-xs font-bold border border-transparent ${meta.cls}`}
                                            >
                                                {MOVEMENT_TYPES.map((t) => (
                                                    <option key={t.value} value={t.value}>
                                                        {t.label}
                                                    </option>
                                                ))}
                                            </select>
                                            {isAdjustment && (
                                                <div className="text-[10px] text-purple-700 dark:text-purple-300 mt-1 font-semibold">
                                                    Cantidad = total final
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-2 font-mono text-xs">{cmd.size}</td>
                                        <td className="p-2 text-right">
                                            <input
                                                type="number"
                                                min={isAdjustment ? 0 : 1}
                                                value={cmd.quantity}
                                                onChange={(e) =>
                                                    update(idx, {
                                                        quantity: Math.max(
                                                            isAdjustment ? 0 : 1,
                                                            Math.floor(Number(e.target.value) || 0)
                                                        )
                                                    })
                                                }
                                                className="w-20 p-1 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded text-right font-bold"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                value={cmd.reason}
                                                onChange={(e) =>
                                                    update(idx, {
                                                        reason: e.target.value.slice(0, 200)
                                                    })
                                                }
                                                className="w-full p-1 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded text-xs"
                                            />
                                        </td>
                                        <td className="p-2 text-center">
                                            <button
                                                onClick={() => remove(idx)}
                                                className="p-1.5 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                aria-label="Quitar"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {edited.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="p-4 text-center text-zinc-400 dark:text-zinc-500 text-sm"
                                    >
                                        Todos los movimientos fueron eliminados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {unmatched.length > 0 && (
                <div>
                    <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                        <MicOff size={14} />
                        No reconocidos ({unmatched.length})
                    </h4>
                    <ul className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {unmatched.map((u, i) => (
                            <li key={i} className="flex justify-between gap-2">
                                <span>&ldquo;{u.raw}&rdquo;</span>
                                {u.quantity != null && (
                                    <span className="font-mono">
                                        {u.quantity} {u.unit || ''}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-500 mt-1">
                        Si estos productos deberían estar disponibles para esta empresa, asignalos en{' '}
                        <span className="font-mono">/admin/catalog</span>.
                    </p>
                </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
                <button
                    onClick={onApply}
                    disabled={edited.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold shadow-md"
                >
                    <Save size={16} />
                    Aplicar {edited.length} movimiento{edited.length === 1 ? '' : 's'}
                </button>
            </div>
            {void catalog}
        </div>
    );
}

function ApplyResults({
    results,
    onClose
}: {
    results: ApplyResultRow[];
    onClose: () => void;
}) {
    const applied = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold">
                    <CheckCircle2 size={16} />
                    {applied.length} aplicado{applied.length === 1 ? '' : 's'}
                </span>
                {failed.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-300 font-semibold">
                        <AlertTriangle size={16} />
                        {failed.length} con error
                    </span>
                )}
            </div>

            {applied.length > 0 && (
                <ul className="text-xs space-y-1">
                    {applied.map((r, i) => {
                        const meta = typeMeta(r.type);
                        // Quantity prefix conveys direction at a glance.
                        const prefix =
                            r.type === 'entry' || r.type === 'release'
                                ? '+'
                                : r.type === 'exit' || r.type === 'reserve'
                                  ? '−'
                                  : '→';
                        return (
                            <li
                                key={i}
                                className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded gap-2"
                            >
                                <span className="flex items-center gap-2 min-w-0">
                                    <span
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${meta.cls}`}
                                    >
                                        {meta.label}
                                    </span>
                                    <span className="truncate">
                                        {r.product_name} · <span className="font-mono">{r.size}</span> ·{' '}
                                        <span className="font-bold">
                                            {prefix}
                                            {r.quantity}
                                        </span>
                                    </span>
                                </span>
                                <span className="font-mono text-emerald-700 dark:text-emerald-300 shrink-0">
                                    {r.noop
                                        ? 'sin cambios'
                                        : `on-hand: ${r.new_on_hand ?? '?'}${
                                              r.new_reserved
                                                  ? ` · reserv: ${r.new_reserved}`
                                                  : ''
                                          }`}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}

            {failed.length > 0 && (
                <ul className="text-xs space-y-1">
                    {failed.map((r, i) => (
                        <li
                            key={i}
                            className="flex justify-between bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded text-red-800 dark:text-red-300"
                        >
                            <span>
                                {r.product_name || '—'} · <span className="font-mono">{r.size}</span>
                            </span>
                            <span>{r.error}</span>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex justify-end pt-2">
                <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-900 dark:hover:bg-zinc-600 text-white font-bold"
                >
                    Cerrar
                </button>
            </div>
        </div>
    );
}
