'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { Camera, Loader2, X } from 'lucide-react';

const punchPathFromQr = (value: string): string | null => {
    try {
        const url = new URL(value.trim());
        if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/empleado/marcar') {
            return null;
        }
        const token = url.searchParams.get('t');
        return token && token.length <= 256
            ? `/empleado/marcar?t=${encodeURIComponent(token)}`
            : null;
    } catch {
        return null;
    }
};

export function EmployeeQrScanner() {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        const video = videoRef.current;
        if (!video) return;

        let active = true;
        let controls: IScannerControls | undefined;
        const reader = new BrowserQRCodeReader();

        reader.decodeFromConstraints(
            { audio: false, video: { facingMode: { ideal: 'environment' } } },
            video,
            (result, _scanError, scanControls) => {
                if (!active || !result) return;
                const path = punchPathFromQr(result.getText());
                if (!path) {
                    setError('Este no es un código de marcaje del taller.');
                    return;
                }

                active = false;
                scanControls.stop();
                setOpen(false);
                router.push(path);
            }
        ).then((scannerControls) => {
            controls = scannerControls;
            if (!active) scannerControls.stop();
            else setLoading(false);
        }).catch((cause: unknown) => {
            if (!active) return;
            setLoading(false);
            setError(
                cause instanceof DOMException && cause.name === 'NotAllowedError'
                    ? 'Permití el acceso a la cámara para escanear el QR.'
                    : 'No se pudo abrir la cámara. Revisá los permisos e intentá de nuevo.'
            );
        });

        return () => {
            active = false;
            controls?.stop();
        };
    }, [open, router]);

    return (
        <div className="mt-4">
            {open ? (
                <div className="space-y-3">
                    <div className="overflow-hidden rounded-xl bg-zinc-950">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            aria-label="Cámara para escanear el código QR del taller"
                            className="aspect-square w-full max-h-80 object-cover"
                        />
                    </div>
                    {loading && (
                        <p className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                            <Loader2 size={16} className="animate-spin" /> Abriendo cámara…
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-zinc-700 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-zinc-200"
                    >
                        <X size={16} /> Cerrar cámara
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => {
                        if (!navigator.mediaDevices?.getUserMedia) {
                            setError('La cámara no está disponible en este navegador.');
                            return;
                        }
                        setError(null);
                        setLoading(true);
                        setOpen(true);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-base font-bold text-white hover:bg-orange-700"
                >
                    <Camera size={20} /> Escanear QR
                </button>
            )}
            {error && (
                <p role="alert" className="mt-3 text-sm font-medium text-red-700 dark:text-red-400">
                    {error}
                </p>
            )}
        </div>
    );
}
