// React Three Fiber 9 registers its scene elements (<mesh>, <group>, <primitive>, lights, materials)
// on React's JSX namespace through this augmentation; without it every element is a type error
// under strict TypeScript. A module augmentation is program-wide; only the island uses the elements.
import type { ThreeElements } from '@react-three/fiber';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
