// Glowing feathers falling from the phoenix at the summit, ported from V1 (src/three/Feathers.jsx).
// Time-based fall so they keep drifting while the visitor rests at the summit; bloom layer;
// gated by reduced motion.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { store, useStore } from '../store';
import { BLOOM_LAYER } from './SelectiveBloom';
import { FEATHERS } from '../data/phoenix';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

function makeFeatherTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 64, 1, 32, 64, 44);
  g.addColorStop(0, 'rgba(255,244,222,1)');
  g.addColorStop(0.45, 'rgba(255,190,110,0.75)');
  g.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(32, 64, 13, 58, 0, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type Seed = { ang: number; radius: number; phase: number; speed: number; life: number };

export default function Feathers() {
  const reducedMotion = useStore((s) => s.reducedMotion);
  const tex = useMemo(() => makeFeatherTexture(), []);
  const color = useMemo(() => new THREE.Color(FEATHERS.color), []);
  const seeds = useMemo<Seed[]>(
    () =>
      Array.from({ length: FEATHERS.count }, (_, i) => ({
        ang: i * 2.39996,
        radius: FEATHERS.spread * (0.35 + 0.65 * ((i * 0.6180339) % 1)),
        phase: (i * 1.7) % (Math.PI * 2),
        speed: 0.8 + ((i * 0.37) % 1) * 0.5,
        life: (i / FEATHERS.count) * FEATHERS.drop,
      })),
    []
  );

  return (
    <group>
      {seeds.map((s, i) => (
        <Feather key={i} seed={s} tex={tex} color={color} reducedMotion={reducedMotion} />
      ))}
    </group>
  );
}

function Feather({ seed, tex, color, reducedMotion }: { seed: Seed; tex: THREE.Texture; color: THREE.Color; reducedMotion: boolean }) {
  const mesh = useRef<THREE.Mesh | null>(null);
  const mat = useRef<THREE.MeshBasicMaterial | null>(null);
  const fallen = useRef(seed.life);

  useEffect(() => {
    mesh.current?.layers.enable(BLOOM_LAYER);
  }, []);

  useFrame((state, dt) => {
    const m = mesh.current;
    if (!m) return;
    const s = store.getState();
    const env = smoothstep(clamp01((s.scrollProgress - FEATHERS.from) / FEATHERS.fadeSpan));
    if (env < 0.01 || reducedMotion) {
      m.visible = false;
      return;
    }
    m.visible = true;
    fallen.current += FEATHERS.fall * seed.speed * dt;
    if (fallen.current > FEATHERS.drop) fallen.current -= FEATHERS.drop;
    const ph = s.phoenixPos;
    const t = state.clock.elapsedTime;
    const sway = Math.sin(t * 0.6 + seed.phase) * FEATHERS.sway;
    m.position.set(
      ph.x + Math.cos(seed.ang) * seed.radius + sway,
      ph.y - fallen.current,
      ph.z + Math.sin(seed.ang) * seed.radius + Math.cos(t * 0.5 + seed.phase) * FEATHERS.sway * 0.5
    );
    m.rotation.z = t * FEATHERS.spin + seed.phase;
    m.scale.setScalar(FEATHERS.size);
    const lifeFade = smoothstep(clamp01(fallen.current / 0.8)) * (1 - smoothstep(clamp01((fallen.current - (FEATHERS.drop - 1.2)) / 1.2)));
    if (mat.current) mat.current.opacity = env * lifeFade;
  });

  return (
    <mesh ref={mesh} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={mat} map={tex} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0} />
    </mesh>
  );
}
