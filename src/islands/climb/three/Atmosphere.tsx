// The night -> sunny tonal arc, ported from V1 (src/three/Atmosphere.jsx): samples the SKY
// palette by scrollProgress for the scene background and fog, and ramps the lights from a dim
// night to a bright day. Lights are grabbed from the scene once; Scene.tsx declares them.
import { useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { store } from '../store';
import { SKY, dayAt } from '../data/palette';

const NIGHT = { ambient: 0.18, hemi: 0.5, dir: 0.72 };
const DAY = { ambient: 0.6, hemi: 1.6, dir: 2.9 };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Lights = { ambient?: THREE.AmbientLight; hemi?: THREE.HemisphereLight; dir?: THREE.DirectionalLight };

export default function Atmosphere() {
  const { scene } = useThree();
  const stops = useMemo(() => SKY.map((s) => ({ at: s.at, c: new THREE.Color(s.color) })), []);
  const scratch = useMemo(() => new THREE.Color(), []);
  const lights = useRef<Lights | null>(null);

  useFrame(() => {
    const p = store.getState().scrollProgress;
    let i = 0;
    while (i < stops.length - 1 && p > stops[i + 1].at) i++;
    const a = stops[i];
    const b = stops[Math.min(i + 1, stops.length - 1)];
    const t = a.at === b.at ? 0 : Math.min(1, Math.max(0, (p - a.at) / (b.at - a.at)));
    scratch.copy(a.c).lerp(b.c, t);
    if ((scene.background as THREE.Color | null)?.isColor) (scene.background as THREE.Color).copy(scratch);
    if (scene.fog) scene.fog.color.copy(scratch);

    if (!lights.current) {
      const l: Lights = {};
      scene.traverse((o) => {
        if ((o as THREE.AmbientLight).isAmbientLight) l.ambient = o as THREE.AmbientLight;
        else if ((o as THREE.HemisphereLight).isHemisphereLight) l.hemi = o as THREE.HemisphereLight;
        else if ((o as THREE.DirectionalLight).isDirectionalLight) l.dir = o as THREE.DirectionalLight;
      });
      lights.current = l;
    }
    const day = dayAt(p);
    const l = lights.current;
    if (l.ambient) l.ambient.intensity = lerp(NIGHT.ambient, DAY.ambient, day);
    if (l.hemi) l.hemi.intensity = lerp(NIGHT.hemi, DAY.hemi, day);
    if (l.dir) l.dir.intensity = lerp(NIGHT.dir, DAY.dir, day);
  });

  return null;
}
