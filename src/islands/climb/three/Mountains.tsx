// Layered distant ridges behind the summit, ported from V1 (src/three/Mountains.jsx): real
// geometry so the ranges parallax against each other as the camera cranes at the top. Revealed
// by scroll (about 0.70 to 0.88), then held.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { store } from '../store';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function ridgeline(t: number, seed: number): number {
  return (Math.sin(t * 0.7 + seed) * 0.55 + Math.sin(t * 1.7 + seed * 1.3) * 0.28 + Math.sin(t * 3.9 + seed * 2.1) * 0.13 + Math.sin(t * 8.3 + seed) * 0.05) * 0.5 + 0.5;
}

function makeRidgeGeo(width: number, height: number, segs: number, peakAmp: number, seed: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(width, height, segs, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const half = height / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    if (pos.getY(i) > 0) pos.setY(i, half + ridgeline(x * 0.06, seed) * peakAmp);
    else pos.setY(i, -half);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

const LAYERS = [
  { dist: 46, width: 150, height: 30, peakAmp: 12, segs: 120, color: '#73869e', maxOp: 0.92, seed: 0.4, y: 1 },
  { dist: 78, width: 220, height: 38, peakAmp: 17, segs: 150, color: '#93a6bd', maxOp: 0.85, seed: 2.3, y: 2 },
  { dist: 118, width: 320, height: 50, peakAmp: 24, segs: 180, color: '#c0ccdb', maxOp: 0.78, seed: 4.9, y: 3 },
];

export default function Mountains() {
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const geos = useMemo(() => LAYERS.map((L) => makeRidgeGeo(L.width, L.height, L.segs, L.peakAmp, L.seed)), []);

  useFrame(() => {
    const p = store.getState().scrollProgress;
    const reveal = clamp01((p - 0.7) / 0.18);
    for (let i = 0; i < mats.current.length; i++) {
      const m = mats.current[i];
      if (m) m.opacity = reveal * LAYERS[i].maxOp;
    }
  });

  return (
    <group>
      {LAYERS.map((L, i) => (
        <mesh key={i} geometry={geos[i]} position={[-L.dist, L.y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <meshBasicMaterial
            ref={(el) => {
              mats.current[i] = el;
            }}
            color={L.color}
            transparent
            opacity={0}
            depthWrite={false}
            fog={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
