'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CenteredGLTF, type PlacedLogo } from '@/components/three-d/centered-gltf';

// Customer 3D viewer: recolorable garment with logo planes at the
// chosen zones. `preserveDrawingBuffer` lets the studio snapshot the
// canvas (toDataURL) for the design-request preview.
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
        <Canvas
            camera={{ position: [0, 0, 4], fov: 35 }}
            dpr={[1, 2]}
            gl={{ preserveDrawingBuffer: true, antialias: true }}
        >
            <ambientLight intensity={0.75} />
            <directionalLight position={[3, 5, 4]} intensity={1.1} />
            <directionalLight position={[-4, 2, -3]} intensity={0.4} />
            <CenteredGLTF url={url} color={color} logos={logos} />
            <OrbitControls makeDefault enablePan={false} minDistance={2} maxDistance={7} />
        </Canvas>
    );
}
