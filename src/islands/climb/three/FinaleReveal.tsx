// "The spark becomes fire", ported from V1 (src/three/FinaleReveal.jsx): as the wingbeat freezes at
// the summit a white-gold flare blooms from the bird and a ring of embers bursts outward, then
// settles into a held glow. Scroll-anchored envelope (honours reduced motion); only the breath,
// bob, and twinkle are autonomous and are dropped when reduced.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { store, useStore } from '../store';
import { BLOOM_LAYER } from './SelectiveBloom';
import { FINALE_REVEAL } from '../data/phoenix';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

function makeGlowTexture(core: string, mid: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 1, 64, 64, 62);
  g.addColorStop(0, core);
  g.addColorStop(0.4, mid);
  g.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(64, 64, 62, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type Seed = { dir: THREE.Vector3; reach: number; phase: number; twinkle: number };

export default function FinaleReveal() {
  const reducedMotion = useStore((s) => s.reducedMotion);
  const flareTex = useMemo(() => makeGlowTexture('rgba(255,248,235,1)', 'rgba(255,210,140,0.5)'), []);
  const emberTex = useMemo(() => makeGlowTexture('rgba(255,236,200,1)', 'rgba(255,180,90,0.5)'), []);
  const flareColor = useMemo(() => new THREE.Color(FINALE_REVEAL.flareColor), []);
  const emberColor = useMemo(() => new THREE.Color(FINALE_REVEAL.emberColor), []);
  const flare = useRef<THREE.Mesh | null>(null);
  const flareMat = useRef<THREE.MeshBasicMaterial | null>(null);
  const embers = useRef<THREE.Group | null>(null);
  const settle = useRef(0);

  const seeds = useMemo<Seed[]>(
    () =>
      Array.from({ length: FINALE_REVEAL.emberCount }, (_, i) => {
        const golden = i * 2.39996;
        const y = 0.15 + 0.85 * ((i + 0.5) / FINALE_REVEAL.emberCount);
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        return {
          dir: new THREE.Vector3(Math.cos(golden) * r, y, Math.sin(golden) * r),
          reach: 0.55 + ((i * 0.37) % 1) * 0.45,
          phase: (i * 1.7) % (Math.PI * 2),
          twinkle: 0.7 + ((i * 0.53) % 1) * 0.6,
        };
      }),
    []
  );

  useEffect(() => {
    flare.current?.layers.enable(BLOOM_LAYER);
    embers.current?.children.forEach((m) => m.layers.enable(BLOOM_LAYER));
  }, []);

  useFrame((state, dt) => {
    const g = flare.current;
    const grp = embers.current;
    if (!g || !grp || !flareMat.current) return;
    const s = store.getState();
    const p = s.scrollProgress;
    const env = smoothstep(clamp01((p - FINALE_REVEAL.from) / (FINALE_REVEAL.full - FINALE_REVEAL.from)));
    if (env < 0.001) {
      g.visible = false;
      for (const m of grp.children) m.visible = false;
      settle.current = 0;
      return;
    }
    const ph = s.phoenixPos;
    const t = state.clock.elapsedTime;
    const out = easeOut(env);
    const breath = reducedMotion ? 0 : Math.sin(t * 1.1) * FINALE_REVEAL.breath;
    const ptr = reducedMotion ? 0 : Math.min(1, Math.hypot(s.pointerX, s.pointerY));
    if (env > 0.995) settle.current = Math.min(1, settle.current + dt / 1.2);
    else settle.current = Math.max(0, settle.current - dt / 0.6);
    const flareLevel = THREE.MathUtils.lerp(FINALE_REVEAL.flarePeak, FINALE_REVEAL.flareHold, settle.current);

    g.visible = true;
    g.position.set(ph.x, ph.y, ph.z);
    g.quaternion.copy(state.camera.quaternion);
    g.scale.setScalar(FINALE_REVEAL.flareSize * (0.5 + 0.5 * out));
    flareMat.current.opacity = clamp01(env * (flareLevel + breath + 0.3 * ptr));

    for (let i = 0; i < grp.children.length; i++) {
      const m = grp.children[i] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
      const sd = seeds[i];
      const dist = FINALE_REVEAL.burstRadius * sd.reach * out;
      const bob = reducedMotion ? 0 : Math.sin(t * 0.5 + sd.phase) * FINALE_REVEAL.bob;
      m.visible = true;
      m.position.set(ph.x + sd.dir.x * dist, ph.y + sd.dir.y * dist + FINALE_REVEAL.rise * out + bob, ph.z + sd.dir.z * dist);
      m.quaternion.copy(state.camera.quaternion);
      m.scale.setScalar(FINALE_REVEAL.emberSize);
      const twk = reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(t * sd.twinkle + sd.phase);
      m.material.opacity = clamp01(env * (0.85 - 0.25 * out) * twk + 0.18 * ptr * env);
    }
  });

  return (
    <group>
      <mesh ref={flare} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={flareMat} map={flareTex} color={flareColor} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0} />
      </mesh>
      <group ref={embers}>
        {seeds.map((_, i) => (
          <mesh key={i} visible={false}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={emberTex} color={emberColor} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
