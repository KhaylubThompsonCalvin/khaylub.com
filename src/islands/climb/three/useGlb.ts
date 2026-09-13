// GLB loading and animation binding on three's own loaders, replacing the drei hooks V1 used
// (useGLTF, useAnimations): drei is not named in an ADR. The GLBs are meshopt-compressed
// (EXT_meshopt_compression), so the decoder is attached to the loader; it is WebAssembly, which is
// why the climb paths carry 'wasm-unsafe-eval' in the Content Security Policy.
import { useEffect, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export function useGlb(url: string): GLTF {
  return useLoader(GLTFLoader, url, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });
}

export type Actions = Record<string, THREE.AnimationAction>;

/** Bind the GLB's clips to a mixer on the loaded scene; the mixer advances every frame. */
export function useMixer(root: THREE.Object3D, clips: THREE.AnimationClip[]): { mixer: THREE.AnimationMixer; actions: Actions; names: string[] } {
  const mixer = useMemo(() => new THREE.AnimationMixer(root), [root]);
  const actions = useMemo(() => {
    const out: Actions = {};
    for (const clip of clips) out[clip.name] = mixer.clipAction(clip);
    return out;
  }, [mixer, clips]);
  const names = useMemo(() => clips.map((c) => c.name), [clips]);
  useFrame((_, dt) => {
    mixer.update(dt);
  });
  useEffect(
    () => () => {
      mixer.stopAllAction();
    },
    [mixer]
  );
  return { mixer, actions, names };
}
