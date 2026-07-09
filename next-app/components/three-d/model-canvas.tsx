'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, type CameraProps } from '@react-three/fiber';
import type * as THREE from 'three';
import { RotateCcw } from 'lucide-react';

// ─── Shared R3F canvas with WebGL context lifecycle handling ────────
// A browser only allows a handful of live WebGL contexts. React Three
// Fiber creates one per <Canvas> but doesn't always release the GPU
// context promptly on unmount, so repeatedly opening the zone editor /
// studio can exhaust them → the canvas silently goes blank ("context
// lost"). This wrapper:
//   • force-releases the context on unmount (prevents the leak), and
//   • surfaces a context-loss with a clear reload prompt instead of a
//     blank/broken canvas.
export function ModelCanvas({
    children,
    camera,
    capture = false
}: {
    children: React.ReactNode;
    camera?: CameraProps;
    /** preserveDrawingBuffer so the customer studio can snapshot it. */
    capture?: boolean;
}) {
    const glRef = useRef<THREE.WebGLRenderer | null>(null);
    const [lost, setLost] = useState(false);

    useEffect(() => {
        return () => {
            // Explicitly free the GPU context so it doesn't linger until
            // GC and starve the next canvas.
            const gl = glRef.current;
            try {
                gl?.forceContextLoss?.();
                gl?.dispose?.();
            } catch {
                /* noop */
            }
            glRef.current = null;
        };
    }, []);

    return (
        <div className="relative w-full h-full">
            <Canvas
                camera={camera}
                dpr={[1, 2]}
                gl={{
                    preserveDrawingBuffer: capture,
                    antialias: true,
                    powerPreference: 'low-power',
                    failIfMajorPerformanceCaveat: false
                }}
                onCreated={({ gl }) => {
                    glRef.current = gl;
                    setLost(false);
                    const canvas = gl.domElement;
                    canvas.addEventListener(
                        'webglcontextlost',
                        (e) => {
                            e.preventDefault();
                            setLost(true);
                        },
                        false
                    );
                    canvas.addEventListener('webglcontextrestored', () => setLost(false), false);
                }}
            >
                {children}
            </Canvas>

            {lost && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-100/90 dark:bg-zinc-900/90 text-center px-4">
                    <p className="text-sm text-gray-600 dark:text-zinc-300 max-w-xs">
                        El visor 3D se quedó sin memoria de video.
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold"
                    >
                        <RotateCcw size={15} /> Recargar
                    </button>
                </div>
            )}
        </div>
    );
}
