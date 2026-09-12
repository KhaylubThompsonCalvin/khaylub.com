// The hero character, ported from V1 (src/three/Wanderer.jsx). The walk clip is paused and its
// time is set from scrollProgress each frame, so scroll drives his stride and he comes to rest at
// the camps. He walks in place: the Root bone's forward drift is locked every frame.
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { store } from '../store';
import { useGlb, useMixer } from './useGlb';

const MODEL = '/climb/wanderer-web.glb';
const WALK_END = 0.66; // scroll fraction by which he has arrived and stops
const CYCLES = 6; // stride cycles across the journey

export default function Wanderer() {
  const { scene, animations } = useGlb(MODEL);
  const { actions, names } = useMixer(scene, animations);
  const walkRef = useRef<THREE.AnimationAction | null>(null);
  const durRef = useRef(1);
  const rootBone = useRef<THREE.Bone | null>(null);

  useEffect(() => {
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone && o.name === 'Root') rootBone.current = o as THREE.Bone;
    });
    const walkName = names.find((n) => /walk/i.test(n)) ?? names[0];
    const action = walkName ? actions[walkName] : undefined;
    if (action) {
      action.reset();
      action.play();
      action.paused = true; // time is driven manually; the mixer still applies the pose
      walkRef.current = action;
      durRef.current = action.getClip().duration;
    }
    store.setReady(true);
  }, [scene, actions, names]);

  useFrame(() => {
    const action = walkRef.current;
    if (!action) return;
    const root = rootBone.current;
    if (root) {
      root.position.x = 0;
      root.position.z = 0;
    }
    const p = store.getState().scrollProgress;
    const walkT = Math.min(1, Math.max(0, p / WALK_END));
    const dur = durRef.current;
    action.time = (walkT * CYCLES * dur) % dur;
  });

  return <primitive object={scene} position={[0, 0, 0]} />;
}
