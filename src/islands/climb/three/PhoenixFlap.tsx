// The phoenix, ported from V1 (src/three/PhoenixFlap.jsx). Dormant until the midpoint, then an
// ember fades in, arcs through the far background along a Catmull-Rom path, and its emission and
// wingbeat ramp ember -> fire across 0.50 -> 0.98. Pointer steering, scroll flair, the summit
// swell, and the wing freeze are all read from the store per frame; gated by reduced motion.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { store, useStore } from '../store';
import { BLOOM_LAYER } from './SelectiveBloom';
import { useGlb, useMixer } from './useGlb';
import {
  PHOENIX,
  FLIGHT,
  EMBER_INTENSITY,
  FIRE_INTENSITY,
  EMBER_COLOR,
  FIRE_COLOR,
  GLIDE_PITCH,
  FLAP_SLOW,
  FLAP_FAST,
  FREEZE_FROM,
  FREEZE_POSE_TIME,
  SCALE_MIN,
  SCALE_MAX,
  BODY_EMBER,
  BODY_FIRE,
  HEADING_OFFSET,
  POINTER,
  SCROLL_FLAIR,
  SUMMIT_INTERACT,
  type FlightPoint,
} from '../data/phoenix';

const MODEL = '/climb/phoenix-flap.glb';
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const PHOENIX_CENTER_LOCAL_Y = 0.3; // the body's visual centre sits this far above the pivot

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

function samplePath(path: FlightPoint[], p: number, out: THREE.Vector3): THREE.Vector3 {
  const last = path[path.length - 1];
  if (p <= path[0].at) return out.fromArray(path[0].pos);
  if (p >= last.at) return out.fromArray(last.pos);
  let i = 0;
  while (i < path.length - 1 && p > path[i + 1].at) i++;
  const a = path[i];
  const b = path[i + 1];
  const t = (p - a.at) / (b.at - a.at);
  const p0 = (path[i - 1] ?? a).pos;
  const p3 = (path[i + 2] ?? b).pos;
  out.x = catmull(p0[0], a.pos[0], b.pos[0], p3[0], t);
  out.y = catmull(p0[1], a.pos[1], b.pos[1], p3[1], t);
  out.z = catmull(p0[2], a.pos[2], b.pos[2], p3[2], t);
  return out;
}

type Emissive = THREE.MeshStandardMaterial;

export default function PhoenixFlap() {
  const group = useRef<THREE.Group | null>(null);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const { scene, animations } = useGlb(MODEL);
  const { actions, names } = useMixer(scene, animations);

  const pos = useMemo(() => new THREE.Vector3(), []);
  const ahead = useMemo(() => new THREE.Vector3(), []);
  const emberCol = useMemo(() => new THREE.Color(EMBER_COLOR), []);
  const fireCol = useMemo(() => new THREE.Color(FIRE_COLOR), []);
  const emitCol = useMemo(() => new THREE.Color(), []);

  const px = useRef(0);
  const py = useRef(0);
  const flair = useRef(0);
  const yaw = useRef(0);
  const yawInit = useRef(false);

  // The feather materials carry the baked ember emission; the body material is matte. Only the
  // emissive ones ramp and bloom; the body is warmed without bloom so the bird reads fire-lit.
  const { emissiveMats, bodyMats } = useMemo(() => {
    const feathers = new Set<Emissive>();
    const body = new Set<Emissive>();
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Emissive[];
      let emissive = false;
      for (const m of mats) {
        if (!m) continue;
        m.fog = false; // the bird flies deep in the scene fog; a glowing phoenix should not haze out
        if (m.emissive && (m.emissive.r || m.emissive.g || m.emissive.b)) {
          feathers.add(m);
          emissive = true;
        } else if (m.emissive) {
          body.add(m);
        }
      }
      if (emissive) mesh.layers.enable(BLOOM_LAYER);
    });
    return { emissiveMats: [...feathers], bodyMats: [...body] };
  }, [scene]);

  const flapAction = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    const flap = names.find((n) => /flap/i.test(n)) ?? names[0];
    const action = flap ? actions[flap] : undefined;
    flapAction.current = action ?? null;
    action?.reset().play();
  }, [actions, names]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const s = store.getState();
    const p = s.scrollProgress;

    if (p < PHOENIX.spark) {
      g.visible = false;
      const decay = Math.min(1, dt * 4);
      px.current -= px.current * decay;
      py.current -= py.current * decay;
      flair.current -= flair.current * decay;
      return;
    }
    g.visible = true;

    const emerge = smoothstep(clamp01((p - PHOENIX.spark) / PHOENIX.emergeSpan));
    const ramp = smoothstep(clamp01((p - PHOENIX.rampFrom) / (PHOENIX.rampTo - PHOENIX.rampFrom)));
    const summit = smoothstep(clamp01((p - SUMMIT_INTERACT.from) / (1 - SUMMIT_INTERACT.from)));
    const live = reducedMotion ? 0 : ramp;
    const kP = 1 - Math.exp(-POINTER.ease * dt);
    px.current += ((live ? s.pointerX : 0) - px.current) * kP;
    py.current += ((live ? s.pointerY : 0) - py.current) * kP;
    const target = live ? clamp01(Math.abs(s.scrollVelocity) / SCROLL_FLAIR.ref) : 0;
    flair.current += (target - flair.current) * (1 - Math.exp(-SCROLL_FLAIR.ease * dt));

    samplePath(FLIGHT, p, pos);
    g.position.copy(pos);
    samplePath(FLIGHT, Math.min(1, p + 0.02), ahead);
    const dx = ahead.x - pos.x;
    const dz = ahead.z - pos.z;
    if (Math.hypot(dx, dz) > 0.02) {
      const targetYaw = Math.atan2(dx, dz) + HEADING_OFFSET;
      if (!yawInit.current) {
        yaw.current = targetYaw;
        yawInit.current = true;
      } else {
        let d = targetYaw - yaw.current;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        yaw.current += d * (1 - Math.exp(-2.6 * dt));
      }
    }
    g.rotation.y = yaw.current;

    const driftX = POINTER.drift[0] + SUMMIT_INTERACT.drift[0] * summit;
    const driftY = POINTER.drift[1] + SUMMIT_INTERACT.drift[1] * summit;
    g.position.x += px.current * driftX * live;
    g.position.y += py.current * driftY * live;
    g.rotation.y += px.current * (POINTER.yaw + SUMMIT_INTERACT.yaw * summit) * live;
    g.rotation.z = -px.current * (POINTER.bank + SUMMIT_INTERACT.bank * summit) * live;
    g.rotation.x = GLIDE_PITCH * (1 - smoothstep(clamp01((p - 0.85) / 0.15)));

    const scl = lerp(SCALE_MIN, SCALE_MAX, ramp) * emerge * (1 + SUMMIT_INTERACT.scaleBoost * summit);
    g.scale.setScalar(scl);

    const pointerGlow = live * Math.min(1, Math.hypot(px.current, py.current)) * (POINTER.emberBoost + SUMMIT_INTERACT.emberBoost * summit);
    const intensity = (lerp(EMBER_INTENSITY, FIRE_INTENSITY, ramp) + SCROLL_FLAIR.emberBoost * flair.current + pointerGlow) * emerge;
    emitCol.copy(emberCol).lerp(fireCol, ramp);
    for (const m of emissiveMats) {
      m.emissive.copy(emitCol);
      m.emissiveIntensity = intensity;
    }
    const bodyI = lerp(BODY_EMBER, BODY_FIRE, ramp) * emerge;
    for (const m of bodyMats) {
      m.emissive.copy(emitCol);
      m.emissiveIntensity = bodyI;
    }

    if (flapAction.current) {
      const a = flapAction.current;
      const base = reducedMotion ? FLAP_SLOW : lerp(FLAP_SLOW, FLAP_FAST, ramp) + SCROLL_FLAIR.flapBoost * flair.current;
      const freeze = smoothstep(clamp01((p - FREEZE_FROM) / (1 - FREEZE_FROM)));
      const wake = SUMMIT_INTERACT.flapWake * summit * live * Math.min(1, Math.hypot(px.current, py.current));
      if (freeze > 0.5 && wake < 0.02) {
        a.paused = true;
        const dur = a.getClip().duration;
        if (reducedMotion) {
          a.time = FREEZE_POSE_TIME;
        } else {
          let d = FREEZE_POSE_TIME - a.time;
          if (d > dur / 2) d -= dur;
          else if (d < -dur / 2) d += dur;
          a.time = (a.time + d * (1 - Math.exp(-6 * dt)) + dur) % dur;
        }
      } else {
        a.paused = false;
        a.timeScale = base * (1 - freeze) + wake;
      }
    }
    if (!reducedMotion) {
      const t = state.clock.elapsedTime;
      g.position.y += Math.sin(t * 0.8) * 0.12 * emerge;
      g.position.x += Math.sin(t * 0.5) * SUMMIT_INTERACT.hoverSwayX * summit;
      g.position.y += Math.sin(t * 0.65 + 1.3) * SUMMIT_INTERACT.hoverSwayY * summit;
    }

    // Publish the live position for the finale camera, the shadow, the trail, and the feathers.
    const pp = s.phoenixPos;
    pp.x = g.position.x;
    pp.y = g.position.y;
    pp.z = g.position.z;
    pp.cy = g.position.y + scl * PHOENIX_CENTER_LOCAL_Y;
    pp.fx = Math.sin(yaw.current);
    pp.fz = Math.cos(yaw.current);
  });

  return <primitive ref={group} object={scene} />;
}
