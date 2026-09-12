// The trail surface and the painted contact shadow, ported from V1 (src/three/Ground.jsx).
import { useMemo } from 'react';
import * as THREE from 'three';

/** Trail height at world (x, z): a gentle rise toward +X plus low-frequency relief. */
export function groundHeight(x: number, z: number): number {
  return x * 0.06 + Math.sin(x * 0.25) * 0.12 + Math.sin(z * 0.2) * 0.1;
}

/** Soft radial-gradient shadow texture shared by the contact shadow and the moving shadows. */
export function makeContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(38,28,16,0.5)');
  grad.addColorStop(0.55, 'rgba(38,28,16,0.18)');
  grad.addColorStop(1, 'rgba(38,28,16,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function Ground() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(80, 80, 96, 96);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals();
    return g;
  }, []);
  const shadowTex = useMemo(() => makeContactShadowTexture(), []);

  return (
    <group>
      <mesh geometry={geo} position={[0, -0.02, 0]}>
        <meshStandardMaterial color="#d8cbb6" roughness={0.95} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0.05]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
