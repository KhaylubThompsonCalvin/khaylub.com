// The full-viewport 3D stage, ported from V1 (src/three/Scene.jsx at v1.0.0-3d-experiment). It
// fills the sticky stage of the island and sits behind the plates and the overlay. The far vista
// plate (SummitBackdrop) is omitted until the owner records the vista image's provenance; the
// procedural ridges (Mountains) still open the summit.
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import Wanderer from './Wanderer';
import PhoenixFlap from './PhoenixFlap';
import EmberTrail from './EmberTrail';
import CameraRig from './CameraRig';
import Atmosphere from './Atmosphere';
import Ground from './Ground';
import Mountains from './Mountains';
import FlyoverShadow from './FlyoverShadow';
import ForeshadowShadow from './ForeshadowShadow';
import Feathers from './Feathers';
import Sun from './Sun';
import FinaleReveal from './FinaleReveal';
import SelectiveBloom from './SelectiveBloom';
import { BLOOM } from '../data/phoenix';

export default function Scene() {
  return (
    <Canvas className="climb-canvas" camera={{ position: [0, 1.8, -3], fov: 38 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={['#e9e1d6']} />
      <fog attach="fog" args={['#e9e1d6', 7, 26]} />

      <hemisphereLight args={['#f7eede', '#c4ad8c', 1.6]} />
      <directionalLight position={[3, 6, 4]} intensity={2.9} color="#fff3e2" castShadow />
      <ambientLight intensity={0.6} />

      {/* Tonal sky: drives the background and fog colour from scroll; outside Suspense so it runs
          while the GLBs load. */}
      <Atmosphere />

      <Suspense fallback={null}>
        <Ground />
        <Mountains />
        <FlyoverShadow />
        <Wanderer />
        <ForeshadowShadow />
        <PhoenixFlap />
        <EmberTrail />
        <Feathers />
        <Sun />
        <FinaleReveal />
      </Suspense>

      <CameraRig />
      {/* Selective bloom takes over the render loop: keep it last in the tree. */}
      <SelectiveBloom strength={BLOOM.strength} radius={BLOOM.radius} threshold={BLOOM.threshold} />
    </Canvas>
  );
}
