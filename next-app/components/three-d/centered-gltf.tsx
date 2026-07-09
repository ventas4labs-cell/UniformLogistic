'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { ZoneDef } from '@/lib/services/three-d-models';

// ─── Shared 3D model primitive ──────────────────────────────────────
// Loads a (meshopt-compressed) .glb, centers + scales it to a ~2-unit
// box so zone coordinates captured in the admin editor line up in the
// customer viewer (both render this same component). Optionally recolors
// the garment, reports surface picks (editor), draws zone markers
// (editor), and projects logo planes at zones (viewer).
//
// Logos are rendered as normal-oriented planes floating just off the
// surface — robust across any model transform. (Surface-conforming
// <Decal> is a future upgrade.)

const LOGO_OFFSET = 0.012; // lift the plane slightly off the surface

export interface PlacedLogo {
    zone: ZoneDef;
    url: string;
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
    /** Viewer: logo textures to project at their zones. */
    logos?: PlacedLogo[];
}

function LogoPlane({ zone, url }: PlacedLogo) {
    // Load imperatively (not useTexture) so a failing/oversized/CORS
    // logo simply doesn't render instead of blanking the whole model.
    // crossOrigin keeps the canvas untainted so the preview snapshot
    // (toDataURL) still works.
    const [texture, setTexture] = useState<THREE.Texture | null>(null);
    useEffect(() => {
        let cancelled = false;
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        loader.load(
            url,
            (t) => {
                if (cancelled) return;
                t.colorSpace = THREE.SRGBColorSpace;
                setTexture(t);
            },
            undefined,
            () => {
                /* ignore — logo just won't show */
            }
        );
        return () => {
            cancelled = true;
        };
    }, [url]);

    const { position, quaternion } = useMemo(() => {
        const n = new THREE.Vector3(...zone.normal);
        if (n.lengthSq() === 0) n.set(0, 0, 1);
        n.normalize();
        const pos = new THREE.Vector3(...zone.position).addScaledVector(n, LOGO_OFFSET);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        return { position: pos, quaternion: q };
    }, [zone]);

    if (!texture) return null;

    return (
        <mesh position={position} quaternion={quaternion} renderOrder={2}>
            <planeGeometry args={[zone.scale, zone.scale]} />
            <meshBasicMaterial
                map={texture}
                transparent
                alphaTest={0.02}
                depthWrite={false}
                toneMapped={false}
                side={THREE.DoubleSide}
            />
        </mesh>
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
                <LogoPlane key={l.zone.id} zone={l.zone} url={l.url} />
            ))}
        </group>
    );
}
