// The philosophy foreshadow, ported from V1 (src/three/ForeshadowShadow.jsx): the phoenix is unseen
// here and felt as a shadow pool sweeping across the lit grass and over the Wanderer.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { store } from '../store';
import { FORESHADOW } from '../data/phoenix';
import { groundHeight, makeContactShadowTexture } from './Ground';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function bump(p: number, a: number, peak: number, b: number): number {
  if (p <= a || p >= b) return 0;
  const t = p < peak ? (p - a) / (peak - a) : (b - p) / (b - peak);
  return smoothstep(clamp01(t));
}

export default function ForeshadowShadow() {
  const mesh = useRef<THREE.Mesh | null>(null);
  const mat = useRef<THREE.MeshBasicMaterial | null>(null);
  const tex = useMemo(() => makeContactShadowTexture(), []);

  useFrame(() => {
    const m = mesh.current;
    if (!m || !mat.current) return;
    const p = store.getState().scrollProgress;
    const env = bump(p, FORESHADOW.from, FORESHADOW.peak, FORESHADOW.to);
    if (env < 0.01) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const u = clamp01((p - FORESHADOW.from) / (FORESHADOW.to - FORESHADOW.from));
    const x = lerp(FORESHADOW.xFrom, FORESHADOW.xTo, u);
    m.position.set(x, groundHeight(x, FORESHADOW.z) + 0.02, FORESHADOW.z);
    m.scale.set(FORESHADOW.size, FORESHADOW.size, 1);
    mat.current.opacity = env * FORESHADOW.maxOpacity;
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={mat} map={tex} transparent depthWrite={false} toneMapped={false} opacity={0} />
    </mesh>
  );
}
