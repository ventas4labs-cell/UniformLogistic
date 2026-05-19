// ─── useDictation — browser dictation with Whisper fallback ───────────
// Phase 4 of the voice dictation rollout (see PRODUCT_STOCK_DICTATION.md
// §11). Picks the best STT path at runtime:
//
//   • mode = 'native'   →  window.SpeechRecognition (Chrome / Safari):
//                          live interim + final transcripts, zero cost,
//                          no audio leaves the device.
//   • mode = 'whisper'  →  MediaRecorder records to a Blob, posted to
//                          /api/admin/stock/voice-transcribe (OpenAI
//                          Whisper). No live transcript — text appears
//                          when stop() resolves.
//   • mode = 'unsupported' → neither path available (e.g. iOS PWA with
//                          mic blocked); start() will surface an error.
//
// API:
//
//   const d = useDictation()
//   d.start()                            // synchronous; call from a click
//   const transcript = await d.stop()    // resolves with the final text
//   d.isRecording   d.isFinalizing
//   d.interim       d.final
//   d.mode          d.error
//
// `interim` is only populated in native mode (it's the live partial).
// `final` accumulates the native finalized chunks. In whisper mode both
// stay empty until `stop()` resolves with the whole transcript.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

type DictationMode = 'native' | 'whisper' | 'unsupported';

interface UseDictationOptions {
    /** BCP-47 tag for native, ISO-639-1 for Whisper. Defaults to 'es-CR' / 'es'. */
    lang?: string;
    /** Endpoint to upload audio to in whisper mode. */
    transcribeUrl?: string;
}

interface UseDictationReturn {
    start: () => void;
    /** Resolves with the final transcript (empty string when nothing was said). */
    stop: () => Promise<string>;
    isRecording: boolean;
    /** True when MediaRecorder finished and we're waiting on Whisper. */
    isFinalizing: boolean;
    mode: DictationMode;
    interim: string;
    final: string;
    error: string | null;
    /** Reset internal state so the next start() begins from clean. */
    reset: () => void;
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

function detectMode(): DictationMode {
    if (typeof window === 'undefined') return 'unsupported';
    if (getRecognitionCtor()) return 'native';
    if (
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function' &&
        typeof MediaRecorder !== 'undefined'
    ) {
        return 'whisper';
    }
    return 'unsupported';
}

export function useDictation(opts: UseDictationOptions = {}): UseDictationReturn {
    const lang = opts.lang ?? 'es-CR';
    const transcribeUrl = opts.transcribeUrl ?? '/api/admin/stock/voice-transcribe';
    // Whisper accepts ISO-639-1 (two letters). 'es-CR' → 'es'.
    const langShort = lang.split('-')[0] || 'es';

    const [mode, setMode] = useState<DictationMode>('unsupported');
    const [isRecording, setIsRecording] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [interim, setInterim] = useState('');
    const [final, setFinal] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Native state
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const finalBufRef = useRef('');
    const userStoppedRef = useRef(false);
    const isIOSRef = useRef(false);

    // Whisper state
    const recorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const stopResolveRef = useRef<((transcript: string) => void) | null>(null);

    // Detect mode on mount — must happen client-side because SSR has no
    // window. We set this in an effect so the SSR markup stays stable.
    useEffect(() => {
        setMode(detectMode());
        isIOSRef.current =
            typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    }, []);

    const cleanupNative = useCallback(() => {
        recognitionRef.current?.abort();
        recognitionRef.current = null;
    }, []);

    const cleanupRecorder = useCallback(() => {
        try {
            recorderRef.current?.stop();
        } catch {
            /* ignore */
        }
        recorderRef.current = null;
        const stream = streamRef.current;
        if (stream) stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        chunksRef.current = [];
    }, []);

    const reset = useCallback(() => {
        cleanupNative();
        cleanupRecorder();
        userStoppedRef.current = false;
        finalBufRef.current = '';
        setInterim('');
        setFinal('');
        setError(null);
        setIsRecording(false);
        setIsFinalizing(false);
    }, [cleanupNative, cleanupRecorder]);

    // Clean up on unmount.
    useEffect(() => {
        return () => {
            cleanupNative();
            cleanupRecorder();
        };
    }, [cleanupNative, cleanupRecorder]);

    // ── start ───────────────────────────────────────────────────────────
    const start = useCallback(() => {
        setError(null);
        finalBufRef.current = '';
        userStoppedRef.current = false;
        setInterim('');
        setFinal('');
        if (typeof window !== 'undefined' && !window.isSecureContext) {
            setError('Dictado requiere HTTPS o localhost.');
            return;
        }

        if (mode === 'native') {
            const Ctor = getRecognitionCtor();
            if (!Ctor) {
                setError('Reconocimiento de voz nativo no disponible.');
                return;
            }
            const r = new Ctor();
            r.continuous = !isIOSRef.current;
            r.interimResults = true;
            r.lang = lang;

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
                if (finalText) {
                    finalBufRef.current += finalText;
                    setFinal(finalBufRef.current);
                }
                setInterim(interimText);
            };
            r.onend = () => {
                // iOS auto-stops; restart unless the user pressed stop.
                if (!userStoppedRef.current && isIOSRef.current) {
                    try {
                        r.start();
                    } catch {
                        /* Safari throws if already started — ignore */
                    }
                }
            };
            r.onerror = (e) => {
                if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                    userStoppedRef.current = true;
                    setError(
                        'Permiso de micrófono denegado. Habilitalo en los ajustes del navegador.'
                    );
                    setIsRecording(false);
                } else if (e.error === 'network') {
                    userStoppedRef.current = true;
                    setError('Error de red en el reconocimiento de voz.');
                    setIsRecording(false);
                }
            };

            recognitionRef.current = r;
            try {
                r.start();
                setIsRecording(true);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo iniciar el dictado.');
            }
            return;
        }

        if (mode === 'whisper') {
            // getUserMedia is async; the user-gesture rule applies to the
            // initial click but starting MediaRecorder inside .then() is
            // fine on every browser that supports the API.
            navigator.mediaDevices
                .getUserMedia({ audio: true })
                .then((stream) => {
                    streamRef.current = stream;
                    const recorder = new MediaRecorder(stream);
                    chunksRef.current = [];
                    recorder.ondataavailable = (e) => {
                        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
                    };
                    recorder.onstop = async () => {
                        // Build blob; preserve the original mime so the server
                        // knows what to send to Whisper.
                        const mimeType = recorder.mimeType || 'audio/webm';
                        const blob = new Blob(chunksRef.current, { type: mimeType });
                        chunksRef.current = [];
                        const resolve = stopResolveRef.current;
                        stopResolveRef.current = null;
                        // Release the mic.
                        streamRef.current?.getTracks().forEach((t) => t.stop());
                        streamRef.current = null;
                        recorderRef.current = null;

                        if (!resolve) return;

                        if (blob.size === 0) {
                            resolve('');
                            return;
                        }

                        setIsFinalizing(true);
                        try {
                            const fd = new FormData();
                            const ext = mimeType.includes('mp4')
                                ? 'm4a'
                                : mimeType.includes('ogg')
                                  ? 'ogg'
                                  : 'webm';
                            fd.append('file', blob, `dictation.${ext}`);
                            fd.append('lang', langShort);
                            const res = await fetch(transcribeUrl, {
                                method: 'POST',
                                body: fd
                            });
                            if (!res.ok) {
                                const data = (await res.json().catch(() => null)) as
                                    | { error?: string }
                                    | null;
                                throw new Error(data?.error || `HTTP ${res.status}`);
                            }
                            const data = (await res.json()) as { transcript?: string };
                            const transcript = String(data.transcript ?? '').trim();
                            finalBufRef.current = transcript;
                            setFinal(transcript);
                            resolve(transcript);
                        } catch (err) {
                            setError(
                                err instanceof Error ? err.message : 'Error al transcribir audio.'
                            );
                            resolve('');
                        } finally {
                            setIsFinalizing(false);
                        }
                    };
                    recorder.onerror = () => {
                        setError('Error al grabar audio.');
                        setIsRecording(false);
                    };
                    recorderRef.current = recorder;
                    try {
                        recorder.start(1000); // collect chunks every second
                        setIsRecording(true);
                    } catch (err) {
                        setError(
                            err instanceof Error ? err.message : 'No se pudo iniciar la grabación.'
                        );
                    }
                })
                .catch((err: Error & { name?: string }) => {
                    if (err?.name === 'NotAllowedError') {
                        setError(
                            'Permiso de micrófono denegado. Habilitalo en los ajustes del navegador.'
                        );
                    } else {
                        setError(err?.message || 'No se pudo acceder al micrófono.');
                    }
                });
            return;
        }

        setError(
            'Tu navegador no soporta dictado nativo ni grabación de audio. Usá Chrome o Safari de escritorio.'
        );
    }, [lang, langShort, mode, transcribeUrl]);

    // ── stop ────────────────────────────────────────────────────────────
    const stop = useCallback(async (): Promise<string> => {
        if (mode === 'native') {
            userStoppedRef.current = true;
            try {
                recognitionRef.current?.stop();
            } catch {
                /* ignore */
            }
            // Wait briefly so trailing interim has a chance to flush to final.
            await new Promise((r) => setTimeout(r, 200));
            recognitionRef.current = null;
            setIsRecording(false);
            // Combine any leftover interim into the buffer.
            const text = (finalBufRef.current + ' ' + (interim || '')).trim();
            return text;
        }

        if (mode === 'whisper') {
            // Promise resolves inside the MediaRecorder.onstop handler.
            if (!recorderRef.current || recorderRef.current.state === 'inactive') {
                setIsRecording(false);
                return '';
            }
            const transcriptPromise = new Promise<string>((resolve) => {
                stopResolveRef.current = resolve;
            });
            try {
                recorderRef.current.stop();
            } catch {
                stopResolveRef.current = null;
                setIsRecording(false);
                return '';
            }
            setIsRecording(false);
            return await transcriptPromise;
        }

        return '';
    }, [interim, mode]);

    return useMemo(
        () => ({
            start,
            stop,
            isRecording,
            isFinalizing,
            mode,
            interim,
            final,
            error,
            reset
        }),
        [start, stop, isRecording, isFinalizing, mode, interim, final, error, reset]
    );
}
