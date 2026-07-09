'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Loader2, Check, Sparkles, Rotate3d } from 'lucide-react';
import type { ThreeDModel } from '@/lib/services/three-d-models';
import type { Logo } from '@/lib/services/logos';
import type { PlacedLogo } from '@/components/three-d/centered-gltf';
import { submitCustomDesignAction } from '@/app/(app)/custom-order/actions';

const ModelViewer3D = dynamic(() => import('./model-viewer-3d'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center text-zinc-400">
            <Loader2 className="animate-spin mr-2" size={18} /> Cargando modelo 3D…
        </div>
    )
});

// Fixed uniform palette (v1 — could later be per-model). Recolors the
// garment material; the chosen name is saved on the request.
const COLORS: { name: string; hex: string }[] = [
    { name: 'Beige', hex: '#d4b896' },
    { name: 'Blanco', hex: '#f5f5f0' },
    { name: 'Gris', hex: '#9aa1a9' },
    { name: 'Azul marino', hex: '#26324f' },
    { name: 'Celeste', hex: '#7fa8c9' },
    { name: 'Verde', hex: '#3f6f4f' },
    { name: 'Negro', hex: '#1c1c1e' }
];

export function CustomOrderStudio({
    models,
    logos
}: {
    models: ThreeDModel[];
    logos: Logo[];
}) {
    const [modelId, setModelId] = useState(models[0].id);
    const [color, setColor] = useState(COLORS[0]);
    const [zoneLogos, setZoneLogos] = useState<Record<string, string>>({});
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [doneRef, setDoneRef] = useState<string | null>(null);
    const viewerRef = useRef<HTMLDivElement>(null);

    const model = useMemo(() => models.find((m) => m.id === modelId) || models[0], [models, modelId]);

    // Logo planes to render on the model.
    const placed: PlacedLogo[] = useMemo(() => {
        if (!model.allowLogoPlacement) return [];
        return model.zones.flatMap((z) => {
            const logo = logos.find((l) => l.id === zoneLogos[z.id]);
            return logo?.imageUrl ? [{ zone: z, url: logo.imageUrl }] : [];
        });
    }, [model, logos, zoneLogos]);

    const setZone = (zoneId: string, logoId: string) =>
        setZoneLogos((prev) => ({ ...prev, [zoneId]: logoId }));

    const capturePreview = (): string => {
        const canvas = viewerRef.current?.querySelector('canvas');
        try {
            return canvas ? canvas.toDataURL('image/png') : '';
        } catch {
            return '';
        }
    };

    const submit = async () => {
        setSubmitting(true);
        setError(null);
        const previewDataUrl = capturePreview();
        const chosen = model.zones
            .map((z) => ({ zoneId: z.id, zoneLabel: z.label, logoId: zoneLogos[z.id] || '' }))
            .filter((l) => l.logoId);
        const res = await submitCustomDesignAction({
            modelId: model.id,
            modelName: model.name,
            colorName: color.name,
            notes: notes.trim(),
            previewDataUrl,
            logos: chosen
        });
        if (res.error) {
            setError(res.error);
            setSubmitting(false);
            return;
        }
        setDoneRef(res.requestRef || 'OK');
    };

    if (doneRef) {
        return (
            <div className="max-w-lg mx-auto text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-5">
                    <Check size={32} strokeWidth={3} />
                </div>
                <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
                    ¡Solicitud enviada!
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2">
                    Tu diseño <span className="font-mono font-bold text-orange-600">{doneRef}</span> quedó
                    registrado. Nuestro equipo lo revisará y te contactará con la cotización.
                </p>
                <Link
                    href="/catalog"
                    className="inline-block mt-7 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold"
                >
                    Volver al catálogo
                </Link>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-3 mb-5">
                <Link
                    href="/catalog"
                    className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                    aria-label="Volver"
                >
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Sparkles size={22} className="text-orange-600 dark:text-orange-400" />
                        Pedido 3D personalizado
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Elegí el color y colocá tus logos. Enviaremos tu diseño para cotización.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
                {/* Viewer */}
                <div
                    ref={viewerRef}
                    className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-gradient-to-b from-zinc-50 to-zinc-200 dark:from-zinc-800 dark:to-zinc-950 h-[420px] lg:h-[560px]"
                >
                    <ModelViewer3D url={model.modelUrl} color={color.hex} logos={placed} />
                    <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-[11px] font-medium text-white">
                        <Rotate3d size={13} /> Arrastrá para rotar
                    </div>
                </div>

                {/* Controls */}
                <div className="space-y-5">
                    {models.length > 1 && (
                        <section>
                            <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                                Modelo
                            </h2>
                            <div className="flex flex-wrap gap-1.5">
                                {models.map((m) => (
                                    <button
                                        key={m.id}
                                        onClick={() => {
                                            setModelId(m.id);
                                            setZoneLogos({});
                                        }}
                                        className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                                            m.id === modelId
                                                ? 'bg-orange-600 text-white'
                                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                                        }`}
                                    >
                                        {m.name}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    <section>
                        <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                            Color: {color.name}
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {COLORS.map((c) => (
                                <button
                                    key={c.name}
                                    onClick={() => setColor(c)}
                                    title={c.name}
                                    aria-label={c.name}
                                    className={`w-9 h-9 rounded-full border-2 transition-transform ${
                                        color.name === c.name
                                            ? 'border-orange-500 scale-110'
                                            : 'border-zinc-300 dark:border-zinc-600'
                                    }`}
                                    style={{ backgroundColor: c.hex }}
                                />
                            ))}
                        </div>
                    </section>

                    {model.allowLogoPlacement && model.zones.length > 0 && (
                        <section>
                            <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                                Logos por zona
                            </h2>
                            {logos.length === 0 ? (
                                <p className="text-xs text-zinc-400 italic">
                                    Tu empresa no tiene logos cargados. Contactanos para agregarlos.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {model.zones.map((z) => {
                                        const sel = logos.find((l) => l.id === zoneLogos[z.id]);
                                        return (
                                            <div
                                                key={z.id}
                                                className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800"
                                            >
                                                <div className="w-9 h-9 shrink-0 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden">
                                                    {sel?.imageUrl ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={sel.imageUrl} alt={sel.name} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <span className="text-[9px] text-zinc-400">—</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">
                                                        {z.label}
                                                    </p>
                                                    <select
                                                        value={zoneLogos[z.id] || ''}
                                                        onChange={(e) => setZone(z.id, e.target.value)}
                                                        className="mt-0.5 w-full text-sm bg-transparent outline-none text-zinc-900 dark:text-zinc-100"
                                                    >
                                                        <option value="">Sin logo</option>
                                                        {logos.map((l) => (
                                                            <option key={l.id} value={l.id}>{l.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}

                    {!model.allowLogoPlacement && (
                        <p className="text-xs text-zinc-400 italic">
                            Este modelo es solo de visualización de color.
                        </p>
                    )}

                    <section>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notas (cantidad, tallas, detalles…)"
                            rows={3}
                            className="w-full p-3 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                        />
                    </section>

                    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                    <button
                        onClick={submit}
                        disabled={submitting}
                        className="w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold shadow-md shadow-orange-500/20 disabled:opacity-60 inline-flex items-center justify-center gap-2 transition-colors"
                    >
                        {submitting ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                        {submitting ? 'Enviando…' : 'Solicitar diseño'}
                    </button>
                </div>
            </div>
        </div>
    );
}
