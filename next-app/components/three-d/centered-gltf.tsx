'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ZoneDef } from '@/lib/services/three-d-models';

// ─── Shared 3D model primitive ──────────────────────────────────────
// Loads a (meshopt-compressed) .glb, centers + scales it to a ~2-unit
// box so zone coordinates captured in the admin editor line up in the
// customer viewer (both render this same component). Optionally recolors
// the garment, reports surface picks (editor), draws zone markers
// (editor), and — in the viewer — marks each placed logo with a small
// pin + a name label (not the logo artwork itself, which reads badly
// slapped flat on a curved garment).

const PIN_OFFSET = 0.03; // lift the pin slightly off the surface

export interface PlacedLogo {
    zone: ZoneDef;
    /** Logo display name shown on the pointer. */
    name: string;
}

interface Props {
    url: string;
    /** Hex color applied to the garment's mesh materials. */
    color?: string;
    /** Editor: called with model-local position + normal on surface click. */
    onPick?: (position: [number, number, number], normal: [number, number, number]) => void;
    /** Editor: draw a small marker at each zone. */
    markers?: ZoneDef[];
    /** Editor: highlight this zone id. */
    activeZoneId?: string;
    /** Viewer: logo pointers (pin + name) to place at their zones. */
    logos?: PlacedLogo[];
}

// A pin dot (rendered into the WebGL scene, so it's in the preview
// snapshot) plus a floating DOM label with the logo name.
function LogoPointer({ zone, name }: PlacedLogo) {
    const position = useMemo(() => {
        const n = new THREE.Vector3(...zone.normal);
        if (n.lengthSq() === 0) n.set(0, 0, 1);
        n.normalize();
        return new THREE.Vector3(...zone.position).addScaledVector(n, PIN_OFFSET);
    }, [zone]);

    return (
        <group position={position}>
            <mesh renderOrder={3}>
                <sphereGeometry args={[0.03, 16, 16]} />
                <meshBasicMaterial color="#ea580c" toneMapped={false} depthTest={false} />
            </mesh>
            <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
                <div className="-translate-y-5 whitespace-nowrap rounded-full bg-[#ea580c] px-2.5 py-1 text-xs font-bold text-white shadow-lg ring-2 ring-white/70">
                    {name}
                </div>
            </Html>
        </group>
    );
}

export function CenteredGLTF({ url, color, onPick, markers = [], activeZoneId, logos = [] }: Props) {
    const { scene } = useGLTF(url);
    const groupRef = useRef<THREE.Group>(null);

    // Clone so multiple canvases / recolors don't mutate the cached scene.
    const cloned = useMemo(() => scene.clone(true), [scene]);

    const { center, scale } = useMemo(() => {
        const box = new THREE.Box3().setFromObject(cloned);
        const size = new THREE.Vector3();
        const c = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(c);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        return { center: c, scale: 2 / maxDim };
    }, [cloned]);

    // Recolor the garment materials (clone materials first so we don't
    // stomp the shared cache).
    useEffect(() => {
        const apply = (m: THREE.Material): THREE.Material => {
            const c = m.clone() as THREE.MeshStandardMaterial;
            if (color && c.color) c.color = new THREE.Color(color);
            // Fabric response: no metalness, and a capped roughness so
            // both the keylights and the studio environment leave visible
            // highlights. Without this a dark color renders as a flat
            // silhouette because a fully-rough matte surface reflects
            // almost nothing. envMapIntensity boosts those reflections so
            // folds and edges read even on black.
            if ('metalness' in c) c.metalness = 0;
            if ('roughness' in c) {
                c.roughness = Math.min(c.roughness ?? 0.7, 0.62);
            }
            if ('envMapIntensity' in c) c.envMapIntensity = 1.3;
            c.needsUpdate = true;
            return c;
        };
        cloned.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh || !mesh.material) return;
            mesh.material = Array.isArray(mesh.material)
                ? mesh.material.map(apply)
                : apply(mesh.material);
        });
    }, [cloned, color]);

    const handleDown = onPick
        ? (e: { stopPropagation: () => void; point: THREE.Vector3; face?: { normal: THREE.Vector3 } | null; object: THREE.Object3D }) => {
              e.stopPropagation();
              const group = groupRef.current;
              if (!group) return;
              const localPoint = group.worldToLocal(e.point.clone());
              const invGroup = new THREE.Matrix4().copy(group.matrixWorld).invert();
              let n = new THREE.Vector3(0, 0, 1);
              if (e.face) {
                  n = e.face.normal.clone().transformDirection(e.object.matrixWorld);
                  n.transformDirection(invGroup).normalize();
              }
              onPick(
                  [localPoint.x, localPoint.y, localPoint.z],
                  [n.x, n.y, n.z]
              );
          }
        : undefined;

    return (
        <group ref={groupRef} scale={scale}>
            <primitive
                object={cloned}
                position={[-center.x, -center.y, -center.z]}
                onClick={handleDown}
            />

            {markers.map((z) => (
                <mesh key={z.id} position={z.position}>
                    <sphereGeometry args={[0.04, 16, 16]} />
                    <meshBasicMaterial
                        color={z.id === activeZoneId ? '#22c55e' : '#ea580c'}
                        toneMapped={false}
                    />
                </mesh>
            ))}

            {logos.map((l) => (
                <LogoPointer key={l.zone.id} zone={l.zone} name={l.name} />
            ))}
        </group>
    );
}
