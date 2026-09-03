'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { getCurrentKioskTokenAction } from '@/app/rrhh/kiosko/actions';

// Full-screen kiosk view for a shared workplace screen. Shows a QR of
// the current punch token and rotates it every 2 min. Employees scan
// it with their own phone (already logged in) to open /empleado/marcar.
export function KioskDisplay({
    kioskToken,
    label
}: {
    kioskToken: string;
    label: string;
}) {
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [rotatesMs, setRotatesMs] = useState<number | null>(null);
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const loadingRef = useRef(false);

    const load = useCallback(async () => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        try {
            const res = await getCurrentKioskTokenAction(kioskToken);
            if (res.error || !res.token || !res.rotatesAt) {
                setError(res.error || 'No se pudo generar el código.');
                return;
            }
            const url = `${window.location.origin}/empleado/marcar?t=${res.token}`;
            const dataUrl = await QRCode.toDataURL(url, {
                width: 520,
                margin: 1,
                errorCorrectionLevel: 'M'
            });
            setError(null);
            setQrDataUrl(dataUrl);
            setRotatesMs(new Date(res.rotatesAt).getTime());
        } catch {
            setError('No se pudo generar el código. Reintentando…');
        } finally {
            loadingRef.current = false;
        }
    }, [kioskToken]);

    // Initial load.
    useEffect(() => {
        load();
    }, [load]);

    // Tick every second: update the countdown and reload once expired.
    useEffect(() => {
        const id = setInterval(() => {
            if (rotatesMs == null) return;
            const left = Math.round((rotatesMs - Date.now()) / 1000);
            setSecondsLeft(Math.max(0, left));
            if (left <= 0) load();
        }, 1000);
        return () => clearInterval(id);
    }, [rotatesMs, load]);

    const mmss =
        secondsLeft == null
            ? ''
            : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-6 py-10">
            <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 text-orange-500 font-black tracking-wide">
                    <span className="bg-orange-600 text-white rounded-lg px-2 py-1 text-lg">UL</span>
                    <span className="text-lg uppercase">Uniform Logistic</span>
                </div>
                <h1 className="mt-4 text-3xl md:text-4xl font-black">Marcá tu jornada</h1>
                <p className="mt-2 text-zinc-400 text-lg">
                    Escaneá el código con tu teléfono para registrar entrada,
                    salida, break o almuerzo.
                </p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-2xl">
                {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={qrDataUrl}
                        alt="Código QR para marcar"
                        className="w-[260px] h-[260px] md:w-[360px] md:h-[360px]"
                    />
                ) : (
                    <div className="w-[260px] h-[260px] md:w-[360px] md:h-[360px] flex items-center justify-center text-zinc-400">
                        {error ? 'Error' : 'Generando…'}
                    </div>
                )}
            </div>

            <div className="mt-6 text-center">
                <p className="text-xl font-bold">{label}</p>
                {error ? (
                    <p className="mt-1 text-red-400">{error}</p>
                ) : (
                    <p className="mt-1 text-zinc-500">
                        El código cambia solo. Se renueva en{' '}
                        <span className="font-mono text-zinc-300">{mmss}</span>
                    </p>
                )}
            </div>
        </div>
    );
}
