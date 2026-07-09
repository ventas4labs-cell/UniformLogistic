'use client';

import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Trash2, MousePointerClick } from 'lucide-react';
import { CenteredGLTF } from '@/components/three-d/centered-gltf';
import type { ZoneDef } from '@/lib/services/three-d-models';

// ─── Admin zone editor ──────────────────────────────────────────────
// Rotate the model, click its surface to drop a preset logo anchor, and
// name / resize each zone. Zones are stored on the model; the customer
// studio places their logos on the enabled ones.

let counter = 0;
const newId = () => `z_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export function ModelZoneEditor({
    url,
    zones,
    onChange
}: {
    url: string;
    zones: ZoneDef[];
    onChange: (zones: ZoneDef[]) => void;
}) {
    const [active, setActive] = useState<string | null>(null);

    const addZone = (position: [number, number, number], normal: [number, number, number]) => {
        const z: ZoneDef = {
            id: newId(),
            label: `Zona ${zones.length + 1}`,
            position,
            normal,
            rotation: [0, 0, 0],
            scale: 0.4
        };
        onChange([...zones, z]);
        setActive(z.id);
    };
    const patch = (id: string, p: Partial<ZoneDef>) =>
        onChange(zones.map((z) => (z.id === id ? { ...z, ...p } : z)));
    const remove = (id: string) => onChange(zones.filter((z) => z.id !== id));

    return (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-3">
            <div className="relative h-80 rounded-xl overflow-hidden bg-gradient-to-b from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                <Canvas camera={{ position: [0, 0, 4], fov: 35 }} dpr={[1, 2]}>
                    <ambientLight intensity={0.75} />
                    <directionalLight position={[3, 5, 4]} intensity={1.1} />
                    <directionalLight position={[-4, 2, -3]} intensity={0.4} />
                    <CenteredGLTF
                        url={url}
                        onPick={addZone}
                        markers={zones}
                        activeZoneId={active ?? undefined}
                    />
                    <OrbitControls makeDefault enablePan={false} />
                </Canvas>
                <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white">
                    <MousePointerClick size={13} />
                    Clic en el modelo para agregar una zona
                </div>
            </div>

            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                {zones.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-zinc-500 italic px-1 py-4 text-center">
                        Sin zonas. Hacé clic sobre el modelo para crear una.
                    </p>
                )}
                {zones.map((z, i) => (
                    <div
                        key={z.id}
                        onMouseEnter={() => setActive(z.id)}
                        className={`rounded-lg border p-2.5 ${
                            z.id === active
                                ? 'border-orange-400 dark:border-orange-600 bg-orange-50/60 dark:bg-orange-950/20'
                                : 'border-gray-200 dark:border-zinc-700'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 shrink-0 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                                {i + 1}
                            </span>
                            <input
                                value={z.label}
                                onChange={(e) => patch(z.id, { label: e.target.value })}
                                className="flex-1 min-w-0 px-2 py-1 text-sm rounded border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-orange-500"
                            />
                            <button
                                type="button"
                                onClick={() => remove(z.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                                aria-label="Eliminar zona"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                        <label className="flex items-center gap-2 mt-2 text-[11px] text-gray-500 dark:text-zinc-400">
                            Tamaño
                            <input
                                type="range"
                                min={0.1}
                                max={1}
                                step={0.05}
                                value={z.scale}
                                onChange={(e) => patch(z.id, { scale: parseFloat(e.target.value) })}
                                className="flex-1 accent-orange-600"
                            />
                            <span className="w-8 text-right font-mono">{z.scale.toFixed(2)}</span>
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
}
