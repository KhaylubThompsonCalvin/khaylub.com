// Selective bloom on three's own postprocessing passes, ported from V1 (src/three/SelectiveBloom.jsx).
// Only objects on BLOOM_LAYER glow (the phoenix's feathers, the sun, the sprites); the cream
// background and the matte Wanderer never bloom. Each frame: a bloom-only pass with everything
// else swapped to black, then the normal render with the blurred glow added on top. Priority 1
// takes over rendering, so this stays last in the scene tree.
import { useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const BLOOM_LAYER = 1;

const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER);
const BLACK = new THREE.MeshBasicMaterial({ color: 'black' });
const _prevClear = new THREE.Color();

type Props = { strength?: number; radius?: number; threshold?: number };

export default function SelectiveBloom({ strength = 1.0, radius = 0.5, threshold = 0.5 }: Props) {
  const { gl, scene, camera, size } = useThree();
  const stash = useRef(new Map<string, THREE.Material | THREE.Material[]>());

  const { bloomComposer, finalComposer, bloomPass, mixPass } = useMemo(() => {
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), strength, radius, threshold);
    const bloomComposer = new EffectComposer(gl);
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass(renderScene);
    bloomComposer.addPass(bloomPass);

    const mixPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: bloomComposer.renderTarget2.texture },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D baseTexture;
          uniform sampler2D bloomTexture;
          varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
          }`,
      }),
      'baseTexture'
    );
    mixPass.needsSwap = true;

    const finalComposer = new EffectComposer(gl);
    finalComposer.addPass(renderScene);
    finalComposer.addPass(mixPass);
    finalComposer.addPass(new OutputPass());
    return { bloomComposer, finalComposer, bloomPass, mixPass };
    // Rebuilt only when the renderer, scene, or camera identity changes; size and the bloom
    // parameters are kept in sync by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useEffect(() => {
    bloomComposer.setSize(size.width, size.height);
    finalComposer.setSize(size.width, size.height);
    bloomPass.setSize(size.width, size.height);
  }, [size, bloomComposer, finalComposer, bloomPass]);

  useEffect(() => {
    bloomPass.strength = strength;
    bloomPass.radius = radius;
    bloomPass.threshold = threshold;
  }, [bloomPass, strength, radius, threshold]);

  // EffectComposer.dispose() frees only its own targets; the bloom pass and the mix material are
  // disposed here so a skip-and-enter cycle leaves nothing behind.
  useEffect(
    () => () => {
      bloomPass.dispose();
      mixPass.material.dispose();
      bloomComposer.dispose();
      finalComposer.dispose();
    },
    [bloomComposer, finalComposer, bloomPass, mixPass]
  );

  useFrame(() => {
    const prevBackground = scene.background;
    const prevFog = scene.fog;
    const prevClear = gl.getClearColor(_prevClear);
    const prevClearAlpha = gl.getClearAlpha();

    scene.background = null;
    scene.fog = null;
    gl.setClearColor(0x000000, 1);
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !bloomLayer.test(mesh.layers)) {
        stash.current.set(mesh.uuid, mesh.material);
        mesh.material = BLACK;
      }
    });
    bloomComposer.render();

    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const m = stash.current.get(mesh.uuid);
      if (m) {
        mesh.material = m;
        stash.current.delete(mesh.uuid);
      }
    });
    scene.background = prevBackground;
    scene.fog = prevFog;
    gl.setClearColor(prevClear, prevClearAlpha);
    finalComposer.render();
  }, 1);

  return null;
}
