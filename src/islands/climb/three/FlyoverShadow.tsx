// The firebird's shadow sweeping over the Wanderer during the overhead pass, ported from V1
// (src/three/FlyoverShadow.jsx): a soft projected pool on the trail surface, tracking the bird's
// published position, gated to the pass window.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { store } from '../store';
import { SHADOW } from '../data/phoenix';
import { groundHeight, makeContactShadowTexture } from './Ground';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function bump(p: number, a: number, peak: number, b: number): number {
  if (p <= a || p >= b) return 0;
  const t = p < peak ? (p - a) / (peak - a) : (b - p) / (b - peak);
  return smoothstep(clamp01(t));
}

export default function FlyoverShadow() {
  const mesh = useRef<THREE.Mesh | null>(null);
  const mat = useRef<THREE.MeshBasicMaterial | null>(null);
  const tex = useMemo(() => makeContactShadowTexture(), []);

  useFrame(() => {
    const m = mesh.current;
    if (!m || !mat.current) return;
    const s = store.getState();
    const env = bump(s.scrollProgress, SHADOW.from, SHADOW.peak, SHADOW.to);
    if (env < 0.01) {
      m.visible = false;
      return;
    }
    const { x, y, z } = s.phoenixPos;
    m.visible = true;
    m.position.set(x, groundHeight(x, z) + 0.015, z);
    const h = Math.max(0, y);
    const size = SHADOW.baseSize + h * SHADOW.sizePerHeight;
    m.scale.set(size, size, 1);
    const heightFade = lerp(1, SHADOW.highFade, clamp01(h / SHADOW.softnessHeight));
    mat.current.opacity = env * SHADOW.maxOpacity * heightFade;
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={mat} map={tex} transparent depthWrite={false} toneMapped={false} opacity={0} />
    </mesh>
  );
}
