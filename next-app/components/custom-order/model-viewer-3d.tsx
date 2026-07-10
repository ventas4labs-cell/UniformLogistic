'use client';

import { Suspense } from 'react';
import { OrbitControls } from '@react-three/drei';
import { CenteredGLTF, type PlacedLogo } from '@/components/three-d/centered-gltf';
import { ModelCanvas } from '@/components/three-d/model-canvas';

// Customer 3D viewer: recolorable garment with logo planes at the
// chosen zones. `preserveDrawingBuffer` lets the studio snapshot the
// canvas (toDataURL) for the design-request preview.
//
// Lighting: a single key + weak fill leaves a dark garment reading as a
// flat silhouette. Instead we use a multi-angle rig — hemisphere fill
// plus key / side / rim / under lights — so the moderately-glossy fabric
// (see centered-gltf) picks up specular highlights from several
// directions that trace its folds, buttons and edges even on black.
// (We deliberately avoid drei's <Environment>: its cube-render-target
// teardown clashes with ModelCanvas's manual WebGL context release.)
export default function ModelViewer3D({
    url,
    color,
    logos
}: {
    url: string;
    color: string;
    logos: PlacedLogo[];
}) {
    return (
        <ModelCanvas camera={{ position: [0, 0, 4], fov: 35 }} capture>
            <ambientLight intensity={0.55} />
            <hemisphereLight args={['#ffffff', '#3a3a3a', 0.5]} />
            {/* Key */}
            <directionalLight position={[4, 6, 5]} intensity={1.1} />
            {/* Fill from the opposite side */}
            <directionalLight position={[-5, 2, 3]} intensity={0.55} />
            {/* Rim / back light so a dark garment separates from the void */}
            <directionalLight position={[0, 3, -6]} intensity={0.85} />
            {/* Gentle under-fill to lift the lower folds */}
            <directionalLight position={[0, -4, 2]} intensity={0.3} />
            {/* Roving point light for a moving specular that reveals form */}
            <pointLight position={[3, 1, 4]} intensity={0.4} />
            <Suspense fallback={null}>
                <CenteredGLTF url={url} color={color} logos={logos} />
            </Suspense>
            <OrbitControls makeDefault enablePan={false} minDistance={2} maxDistance={7} />
        </ModelCanvas>
    );
}
