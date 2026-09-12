// The camera, ported from V1 (src/three/CameraRig.jsx). Keyframed shots interpolated by
// scrollProgress so the camera moves around the in-place Wanderer; in the finale it orbits the
// still-flying firebird a full turn and lands head-on. Reads the store with getState() each frame.
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { store, useStore } from '../store';
import { samplePath, segmentEase, POINTER_PARALLAX, FINALE, type Sampled } from '../data/camera';
import { PHOENIX } from '../data/phoenix';

const FOLLOW = 7.0; // settle smoothing: 1/FOLLOW is the time constant (about 0.14 s)
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();
const _olook = new THREE.Vector3();
const _track = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _off = new THREE.Vector3();
const _sampled: Sampled = { pos: [0, 0, 0], look: [0, 0, 0] };

function sample(p: number, outPos: THREE.Vector3, outLook: THREE.Vector3) {
  samplePath(p, _sampled);
  outPos.fromArray(_sampled.pos);
  outLook.fromArray(_sampled.look);
}

export default function CameraRig() {
  const { camera } = useThree();
  const reducedMotion = useStore((s) => s.reducedMotion);
  const lookRef = useRef<THREE.Vector3>(
    (() => {
      samplePath(0, _sampled);
      return new THREE.Vector3().fromArray(_sampled.look);
    })()
  );
  const ppx = useRef(0);
  const ppy = useRef(0);

  useFrame((state, dt) => {
    const s = store.getState();
    const p = s.scrollProgress;
    sample(p, _pos, _look);

    if (!reducedMotion) {
      const t = state.clock.elapsedTime;
      _pos.x += Math.sin(t * 0.5) * 0.04;
      _pos.y += Math.sin(t * 0.37) * 0.03;
      const eng = smoothstep(clamp01((p - PHOENIX.spark) / (PHOENIX.rampTo - PHOENIX.spark)));
      const kP = 1 - Math.exp(-POINTER_PARALLAX.ease * dt);
      ppx.current += (s.pointerX - ppx.current) * kP;
      ppy.current += (s.pointerY - ppy.current) * kP;
      _pos.x -= ppx.current * POINTER_PARALLAX.x * eng;
      _pos.y -= ppy.current * POINTER_PARALLAX.y * eng;
    }

    if (p >= FINALE.from) {
      const e = smoothstep(clamp01((p - FINALE.from) / FINALE.trackIn));
      const eLook = smoothstep(clamp01((p - FINALE.from) / (FINALE.trackIn * 0.4)));
      const prog = segmentEase(clamp01((p - (FINALE.from + FINALE.spinDelay)) / (FINALE.orbitTo - FINALE.from - FINALE.spinDelay)));
      const ph = s.phoenixPos;
      _olook.set(ph.x, ph.cy, ph.z);
      _fwd.set(ph.fx, 0, ph.fz);
      if (_fwd.lengthSq() < 1e-4) _fwd.set(1, 0, 0);
      _fwd.normalize();
      const fo = FINALE.frontOffset;
      if (fo) {
        const cf = Math.cos(fo);
        const sf = Math.sin(fo);
        _fwd.set(_fwd.x * cf + _fwd.z * sf, 0, -_fwd.x * sf + _fwd.z * cf);
      }
      const phi = prog * Math.PI * 2;
      const ca = Math.cos(phi);
      const sa = Math.sin(phi);
      _off.set(_fwd.x * ca + _fwd.z * sa, 0, -_fwd.x * sa + _fwd.z * ca).multiplyScalar(FINALE.orbitDist);
      _off.y = FINALE.orbitHeight;
      _track.copy(_olook).add(_off);
      _pos.lerp(_track, e);
      _look.lerp(_olook, eLook);
    }

    const eFin = p >= FINALE.from ? smoothstep(clamp01((p - FINALE.from) / FINALE.trackIn)) : 0;
    const follow = FOLLOW + (FINALE.follow - FOLLOW) * eFin;
    const k = 1 - Math.exp(-follow * dt);
    camera.position.lerp(_pos, k);
    lookRef.current.lerp(_look, k);
    camera.lookAt(lookRef.current);
  });

  return null;
}
