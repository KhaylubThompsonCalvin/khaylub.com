// The summit sun, ported from V1 (src/three/Sun.jsx): a bright emissive sphere on the bloom layer,
// high and far behind the phoenix's flight, igniting late on the final approach.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { store } from '../store';
import { BLOOM_LAYER } from './SelectiveBloom';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const SUN_POS: [number, number, number] = [-8, 18, 27];

export default function Sun() {
  const group = useRef<THREE.Group | null>(null);
  const mat = useRef<THREE.MeshStandardMaterial | null>(null);

  useEffect(() => {
    group.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.layers.enable(BLOOM_LAYER);
    });
  }, []);

  const geo = useMemo(() => new THREE.SphereGeometry(2.2, 40, 40), []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const p = store.getState().scrollProgress;
    const e = smoothstep(clamp01((p - 0.84) / 0.16));
    if (e < 0.01) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.scale.setScalar(1 + e * 0.4);
    if (mat.current) mat.current.emissiveIntensity = 0.6 + e * 1.0;
  });

  return (
    <group ref={group} position={SUN_POS} visible={false}>
      <mesh geometry={geo}>
        <meshStandardMaterial ref={mat} color="#fff3d8" emissive="#ffe2a6" emissiveIntensity={1.5} roughness={1} metalness={0} fog={false} />
      </mesh>
    </group>
  );
}
