'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    CheckCircle2,
    Loader2,
    Receipt,
    Upload,
    X
} from 'lucide-react';
import { resizeImageFile } from '@/lib/resize-image';
import {
    submitStationInvoiceAction,
    uploadStationInvoiceImageAction
} from '@/app/(station)/station/actions';

interface Props {
    onClose: () => void;
}

// Two-step flow:
//  1. WARNING — explains the photo must be high-quality + readable.
//     The station user must explicitly acknowledge before the upload
//     surface appears. Cuts down on blurry resubmissions.
//  2. UPLOAD — drag/drop or file picker, optional amount, optional
//     note. Confirm uploads to the station-invoices bucket and
//     records a row in station_invoices.
type Step = 'warning' | 'upload' | 'done';

export function SubmitInvoiceModal({ onClose }: Props) {
    const router = useRouter();
    const [step, setStep] = useState<Step>('warning');
    const [imageUrl, setImageUrl] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const handleImageFile = async (file: File) => {
        setUploadingImage(true);
        setError(null);
        try {
            // Resize in-browser to cap upload at ~1 MB while staying
            // readable. Phone photos straight from the camera are
            // 8-15 MB which would trip the 5 MB cap.
            const { file: optimized } = await resizeImageFile(file);
            const fd = new FormData();
            fd.append('file', optimized);
            const url = await uploadStationInvoiceImageAction(fd);
            setImageUrl(url);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Error al subir la imagen'
            );
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSubmit = () => {
        if (!imageUrl) {
            setError('Subí la foto de la factura primero.');
            return;
        }
        setError(null);
        const amt = amount.trim() === '' ? null : parseFloat(amount.replace(',', '.'));
        if (amt != null && (!Number.isFinite(amt) || amt < 0)) {
            setError('Monto inválido.');
            return;
        }
        startTransition(async () => {
            try {
                await submitStationInvoiceAction({
                    imageUrl,
                    amount: amt,
                    notes: notes.trim() || undefined
                });
                setStep('done');
                router.refresh();
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : 'Error al enviar la factura'
                );
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Receipt size={20} className="text-orange-600 dark:text-orange-400" />
                        Enviar factura
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                {step === 'warning' && (
                    <div className="p-6 space-y-4">
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                            <AlertTriangle
                                size={22}
                                className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                            />
                            <div>
                                <p className="font-bold text-amber-900 dark:text-amber-200 mb-1">
                                    La factura debe ser una foto de alta calidad y
                                    legible.
                                </p>
                                <p className="text-sm text-amber-800 dark:text-amber-300">
                                    Necesitamos leer claramente el monto, número de
                                    factura y datos del emisor para poder procesar el
                                    pago. Si la foto está borrosa o cortada te la
                                    pediremos de nuevo.
                                </p>
                            </div>
                        </div>

                        <ul className="text-sm text-gray-700 dark:text-zinc-300 space-y-1.5 pl-1">
                            <li>• Tomá la foto con buena luz, sin sombras.</li>
                            <li>• Mantené la cámara en paralelo al papel.</li>
                            <li>• Que la factura entre completa en la foto.</li>
                            <li>• Evitá dedos o reflejos sobre el documento.</li>
                        </ul>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep('upload')}
                                className="flex-1 py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700"
                            >
                                Entendido, continuar
                            </button>
                        </div>
                    </div>
                )}

                {step === 'upload' && (
                    <div className="p-6 space-y-4">
                        <Field label="Foto de la factura *">
                            <label
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragging(true);
                                }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragging(false);
                                    const f = e.dataTransfer.files?.[0];
                                    if (f) handleImageFile(f);
                                }}
                                className={`flex items-center gap-3 border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                                    dragging
                                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                                        : imageUrl
                                          ? 'border-green-300 bg-green-50/40 dark:bg-green-950/30 hover:border-orange-400'
                                          : 'border-gray-300 dark:border-zinc-700 hover:border-orange-400 hover:bg-orange-50/50'
                                }`}
                            >
                                {uploadingImage ? (
                                    <Loader2
                                        className="animate-spin text-gray-400 dark:text-zinc-500 shrink-0"
                                        size={22}
                                    />
                                ) : imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={imageUrl}
                                        alt="Vista previa de la factura"
                                        className="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-zinc-800 shrink-0 bg-white"
                                    />
                                ) : (
                                    <Upload
                                        className="text-gray-400 dark:text-zinc-500 shrink-0"
                                        size={22}
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-gray-700 dark:text-zinc-300 flex items-center gap-1.5">
                                        {imageUrl ? (
                                            <>
                                                <CheckCircle2
                                                    className="text-green-600 dark:text-green-400"
                                                    size={14}
                                                />
                                                Foto cargada
                                            </>
                                        ) : (
                                            <>Tomar foto o seleccionar archivo</>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                                        {imageUrl
                                            ? 'Reemplazá tocando otra vez si la foto no se ve bien.'
                                            : 'PNG, JPG, WEBP · máx. 5 MB'}
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handleImageFile(f);
                                        e.target.value = '';
                                    }}
                                    disabled={uploadingImage}
                                    className="hidden"
                                />
                            </label>
                        </Field>

                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Monto (opcional)">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="ej. 45000"
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent"
                                />
                            </Field>
                            <Field label="Nota (opcional)">
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="N° factura, referencia..."
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent"
                                />
                            </Field>
                        </div>

                        {error && (
                            <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900/50">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setStep('warning')}
                                className="flex-1 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                            >
                                Atrás
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={pending || !imageUrl || uploadingImage}
                                className="flex-1 py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:bg-gray-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {pending ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : null}
                                Enviar factura
                            </button>
                        </div>
                    </div>
                )}

                {step === 'done' && (
                    <div className="p-8 text-center space-y-4">
                        <div className="mx-auto w-14 h-14 rounded-full bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 flex items-center justify-center">
                            <CheckCircle2 size={28} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 dark:text-zinc-100">
                                Factura enviada
                            </p>
                            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                                Recibimos tu factura. Te pagaremos el monto
                                correspondiente según los términos acordados.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700"
                        >
                            Cerrar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                {label}
            </label>
            {children}
        </div>
    );
}
