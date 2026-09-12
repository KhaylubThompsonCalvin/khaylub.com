// Sparks shed behind the firebird along its flight, ported from V1 (src/three/EmberTrail.jsx).
// A time-throttled history of the bird's live position places pool sprites at recent points,
// fading and shrinking toward the tail. Bloom layer, additive, reduced-motion gated.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { store, useStore } from '../store';
import { BLOOM_LAYER } from './SelectiveBloom';
import { TRAIL } from '../data/phoenix';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

function makeEmberTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,238,200,1)');
  g.addColorStop(0.4, 'rgba(255,165,80,0.6)');
  g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function EmberTrail() {
  const group = useRef<THREE.Group | null>(null);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const tex = useMemo(() => makeEmberTexture(), []);
  const color = useMemo(() => new THREE.Color(TRAIL.color), []);
  const hist = useMemo(() => Array.from({ length: TRAIL.count }, () => new THREE.Vector3()), []);
  const filled = useRef(0);
  const acc = useRef(0);

  useEffect(() => {
    group.current?.children.forEach((m) => m.layers.enable(BLOOM_LAYER));
  }, []);

  useFrame((state, dt) => {
    const grp = group.current;
    if (!grp) return;
    const s = store.getState();
    const p = s.scrollProgress;
    const env = smoothstep(clamp01((p - TRAIL.from) / TRAIL.fadeSpan));
    if (env < 0.01 || reducedMotion) {
      for (const m of grp.children) m.visible = false;
      filled.current = 0;
      acc.current = 0;
      return;
    }
    const ph = s.phoenixPos;
    acc.current += dt;
    if (acc.current >= TRAIL.sampleDt || filled.current === 0) {
      acc.current = 0;
      for (let i = hist.length - 1; i > 0; i--) hist[i].copy(hist[i - 1]);
      hist[0].set(ph.x, ph.y, ph.z);
      filled.current = Math.min(hist.length, filled.current + 1);
    }
    const denom = hist.length - 1 || 1;
    for (let i = 0; i < grp.children.length; i++) {
      const m = grp.children[i] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
      if (i >= filled.current) {
        m.visible = false;
        continue;
      }
      const age = i / denom;
      m.visible = true;
      m.position.copy(hist[i]);
      m.quaternion.copy(state.camera.quaternion);
      m.scale.setScalar(TRAIL.size * (1 - 0.7 * age));
      m.material.opacity = env * TRAIL.baseOpacity * (1 - age) * (1 - age);
    }
  });

  return (
    <group ref={group}>
      {Array.from({ length: TRAIL.count }).map((_, i) => (
        <mesh key={i} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0} />
        </mesh>
      ))}
    </group>
  );
}
