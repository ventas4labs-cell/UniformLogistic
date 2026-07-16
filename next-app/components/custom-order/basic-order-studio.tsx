'use client';

import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, Loader2, Check, Sparkles, Rotate3d } from 'lucide-react';
import type { ThreeDModel, DesignItem } from '@/lib/services/three-d-models';
import type { Logo } from '@/lib/services/logos';
import type { SizeSelection } from '@/lib/types';
import type { PlacedLogo } from '@/components/three-d/centered-gltf';
import {
    submitCustomDesignAction,
    uploadCustomLogoAction
} from '@/app/(app)/custom-order/actions';

const ModelViewer3D = dynamic(() => import('./model-viewer-3d'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center text-zinc-400">
            <Loader2 className="animate-spin mr-2" size={18} /> Cargando modelo 3D…
        </div>
    )
});

type ZoneChoice =
    | { type: 'company'; logoId: string }
    | { type: 'custom'; url: string; name: string };

const CUSTOM = '__custom__';

const COLORS: { name: string; hex: string }[] = [
    { name: 'Beige', hex: '#d4b896' },
    { name: 'Blanco', hex: '#f5f5f0' },
    { name: 'Gris', hex: '#9aa1a9' },
    { name: 'Azul marino', hex: '#26324f' },
    { name: 'Celeste', hex: '#7fa8c9' },
    { name: 'Verde', hex: '#3f6f4f' },
    { name: 'Negro', hex: '#1c1c1e' }
];

function sizeLabel(sel: SizeSelection): string {
    if (sel.waist) return sel.inseam ? `${sel.waist}"×${sel.inseam}"` : `C${sel.waist}"`;
    const prefix = sel.gender === 'Men' ? 'Hombre' : sel.gender === 'Women' ? 'Mujer' : '';
    return prefix ? `${prefix} · ${sel.size}` : sel.size || '';
}

export function BasicOrderStudio({
    product,
    model,
    logos,
    sizeItems,
    onBack,
    onClose
}: {
    product: { code: string; name: string };
    model: ThreeDModel;
    logos: Logo[];
    sizeItems: { selection: SizeSelection; quantity: number }[];
    onBack: () => void;
    onClose: () => void;
}) {
    const [color, setColor] = useState(COLORS[0]);
    const [zoneLogos, setZoneLogos] = useState<Record<string, ZoneChoice>>({});
    const [uploadingZone, setUploadingZone] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [doneRef, setDoneRef] = useState<string | null>(null);
    const viewerRef = useRef<HTMLDivElement>(null);
    const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const totalPieces = sizeItems.reduce((s, i) => s + i.quantity, 0);

    const placed: PlacedLogo[] = useMemo(() => {
        if (!model.allowLogoPlacement) return [];
        return model.zones.flatMap((z) => {
            const c = zoneLogos[z.id];
            if (!c) return [];
            if (c.type === 'custom') return [{ zone: z, name: c.name }];
            const logo = logos.find((l) => l.id === c.logoId);
            return logo ? [{ zone: z, name: logo.name }] : [];
        });
    }, [model, logos, zoneLogos]);

    const clearZone = (zoneId: string) =>
        setZoneLogos((prev) => {
            const n = { ...prev };
            delete n[zoneId];
            return n;
        });
    const setCompanyLogo = (zoneId: string, logoId: string) =>
        logoId
            ? setZoneLogos((prev) => ({ ...prev, [zoneId]: { type: 'company', logoId } }))
            : clearZone(zoneId);

    const handleCustomFile = async (zoneId: string, file: File) => {
        setError(null);
        if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
            setError('Solo se permiten imágenes JPG o PNG.');
            return;
        }
        setUploadingZone(zoneId);
        const fd = new FormData();
        fd.append('file', file);
        const res = await uploadCustomLogoAction(fd);
        setUploadingZone(null);
        if (res.error || !res.url) {
            setError(res.error || 'No se pudo subir la imagen.');
            return;
        }
        setZoneLogos((prev) => ({ ...prev, [zoneId]: { type: 'custom', url: res.url!, name: file.name } }));
    };

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
        const items: DesignItem[] = sizeItems.map((s) => ({
            size: sizeLabel(s.selection),
            quantity: s.quantity,
            selection: s.selection
        }));
        type Chosen = {
            zoneId: string;
            zoneLabel: string;
            logoId: string | null;
            customUrl?: string;
            customName?: string;
        };
        const chosen = model.zones.flatMap((z): Chosen[] => {
            const c = zoneLogos[z.id];
            if (!c) return [];
            if (c.type === 'custom') {
                return [{ zoneId: z.id, zoneLabel: z.label, logoId: null, customUrl: c.url, customName: c.name }];
            }
            return [{ zoneId: z.id, zoneLabel: z.label, logoId: c.logoId }];
        });
        const res = await submitCustomDesignAction({
            modelId: model.id,
            modelName: model.name,
            colorName: color.name,
            notes: notes.trim(),
            previewDataUrl: capturePreview(),
            logos: chosen,
            items
        });
        if (res.error) {
            setError(res.error);
            setSubmitting(false);
            return;
        }
        setDoneRef(res.requestRef || 'OK');
    };

    return (
        <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-950 overflow-y-auto">
            <div className="max-w-6xl mx-auto p-4 sm:p-6">
                {doneRef ? (
                    <div className="max-w-lg mx-auto text-center py-20">
                        <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-5">
                            <Check size={32} strokeWidth={3} />
                        </div>
                        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
                            ¡Solicitud enviada!
                        </h1>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
                            Tu solicitud <span className="font-mono font-bold text-orange-600">{doneRef}</span> quedó
                            registrada. La revisaremos y, al aceptarla, se creará tu pedido.
                        </p>
                        <button
                            onClick={onClose}
                            className="mt-7 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold"
                        >
                            Volver al catálogo
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-3 mb-5">
                            <button
                                onClick={onBack}
                                className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                                aria-label="Volver a tallas"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2 truncate">
                                    <Sparkles size={22} className="text-orange-600 dark:text-orange-400 shrink-0" />
                                    {product.name}
                                </h1>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    {totalPieces} pieza{totalPieces === 1 ? '' : 's'} · elegí color y logos
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
                            <div
                                ref={viewerRef}
                                className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-gradient-to-b from-zinc-50 to-zinc-200 dark:from-zinc-800 dark:to-zinc-950 h-[420px] lg:h-[560px]"
                            >
                                <ModelViewer3D url={model.modelUrl} color={color.hex} logos={placed} />
                                <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-[11px] font-medium text-white">
                                    <Rotate3d size={13} /> Arrastrá para rotar
                                </div>
                            </div>

                            <div className="space-y-5">
                                {/* Size summary */}
                                <section>
                                    <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                                        Tallas
                                    </h2>
                                    <div className="flex flex-wrap gap-1.5">
                                        {sizeItems.map((s, i) => (
                                            <span
                                                key={i}
                                                className="text-xs font-bold px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
                                            >
                                                {sizeLabel(s.selection)} ×{s.quantity}
                                            </span>
                                        ))}
                                    </div>
                                </section>

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
                                        {logos.length === 0 && !model.allowCustomLogo ? (
                                            <p className="text-xs text-zinc-400 italic">
                                                Tu empresa no tiene logos cargados. Contactanos para agregarlos.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {model.zones.map((z) => {
                                                    const c = zoneLogos[z.id];
                                                    const isCustom = c?.type === 'custom';
                                                    const companyLogoId = c?.type === 'company' ? c.logoId : '';
                                                    const companyLogo =
                                                        c?.type === 'company'
                                                            ? logos.find((l) => l.id === c.logoId)
                                                            : undefined;
                                                    const thumb = isCustom ? c.url : companyLogo?.imageUrl;
                                                    return (
                                                        <div
                                                            key={z.id}
                                                            className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800"
                                                        >
                                                            <div className="w-9 h-9 shrink-0 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden">
                                                                {thumb ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={thumb} alt="logo" className="w-full h-full object-contain" />
                                                                ) : (
                                                                    <span className="text-[9px] text-zinc-400">—</span>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">
                                                                    {z.label}
                                                                </p>
                                                                <select
                                                                    value={isCustom ? CUSTOM : companyLogoId}
                                                                    onChange={(e) => {
                                                                        const v = e.target.value;
                                                                        if (v === CUSTOM) fileRefs.current[z.id]?.click();
                                                                        else setCompanyLogo(z.id, v);
                                                                    }}
                                                                    className="mt-0.5 w-full text-sm bg-transparent outline-none text-zinc-900 dark:text-zinc-100"
                                                                >
                                                                    <option value="">Sin logo</option>
                                                                    {logos.map((l) => (
                                                                        <option key={l.id} value={l.id}>{l.name}</option>
                                                                    ))}
                                                                    {model.allowCustomLogo && (
                                                                        <option value={CUSTOM}>Subir logo personalizado…</option>
                                                                    )}
                                                                </select>
                                                                {isCustom && (
                                                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                                                        {c.name}
                                                                    </p>
                                                                )}
                                                                {uploadingZone === z.id && (
                                                                    <p className="text-[11px] text-orange-600 dark:text-orange-400">Subiendo…</p>
                                                                )}
                                                            </div>
                                                            <input
                                                                type="file"
                                                                accept="image/png,image/jpeg,image/jpg"
                                                                className="hidden"
                                                                ref={(el) => {
                                                                    fileRefs.current[z.id] = el;
                                                                }}
                                                                onChange={(e) => {
                                                                    const f = e.target.files?.[0];
                                                                    if (f) handleCustomFile(z.id, f);
                                                                    e.target.value = '';
                                                                }}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </section>
                                )}

                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Notas (detalles, indicaciones…)"
                                    rows={3}
                                    className="w-full p-3 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                                />

                                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                                <button
                                    onClick={submit}
                                    disabled={submitting}
                                    className="w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold shadow-md shadow-orange-500/20 disabled:opacity-60 inline-flex items-center justify-center gap-2 transition-colors"
                                >
                                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                    {submitting ? 'Enviando…' : 'Solicitar pedido'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
