// Camera choreography, ported verbatim from V1 (src/data/camera.js at v1.0.0-3d-experiment): one
// keyframed shot per beat, sampled by scrollProgress. The Wanderer walks in place at the origin
// (+X = his facing); the camera moves around him so the journey reads through composition:
// behind (arrival) -> eases back (philosophy) -> swings to his side (focus) -> orbits to his front
// (discovery) -> holds off-centre (exploration) -> cranes up at the close (contact). Metres.

export type Shot = { id: string; at: number; pos: [number, number, number]; look: [number, number, number] };

export const SHOTS: Shot[] = [
  // arrival: ground-level, close behind; the Wanderer a silhouette against the dark sky
  { id: 'arrival', at: 0.0, pos: [-2.1, 0.48, 0.18], look: [2.6, 0.72, -0.5] },
  // philosophy: the camera rises hard so the climb is felt starting; the sky opens
  { id: 'philosophy', at: 0.21, pos: [-3.8, 2.2, 0.65], look: [1.6, 1.05, -0.8] },
  { id: 'focus', at: 0.39, pos: [-1.4, 1.2, 1.9], look: [0.2, 0.7, -0.3] },
  { id: 'discovery', at: 0.57, pos: [2.4, 1.15, 1.2], look: [0.0, 0.72, 0.0] },
  { id: 'exploration', at: 0.77, pos: [2.6, 1.05, -1.5], look: [0.0, 0.7, 0.3] },
  { id: 'contact', at: 0.94, pos: [2.3, 1.6, -0.3], look: [0.0, 1.0, 0.0] },
];

// Motion feel: a non-uniform Catmull-Rom (cubic Hermite, finite-difference tangents in the scroll
// domain) through the keyframes, so velocity is continuous across every seam, with a mild uniform
// ease per segment (about 70 percent flow speed at the shot, never a stop).
export const EASE_WEIGHT = 0.2; // 0 = constant flow, 1 = full smoothstep
export const segmentEase = (t: number): number => {
  const s = t * t * (3 - 2 * t);
  return t + (s - t) * EASE_WEIGHT;
};

function tangentAt(vals: number[], times: number[], i: number): number {
  const n = vals.length;
  if (i === 0) return (vals[1] - vals[0]) / (times[1] - times[0]);
  if (i === n - 1) return (vals[n - 1] - vals[n - 2]) / (times[n - 1] - times[n - 2]);
  const dtL = times[i] - times[i - 1];
  const dtR = times[i + 1] - times[i];
  const slopeL = (vals[i] - vals[i - 1]) / dtL;
  const slopeR = (vals[i + 1] - vals[i]) / dtR;
  return (slopeL * dtR + slopeR * dtL) / (dtL + dtR);
}

const TIMES = SHOTS.map((s) => s.at);
const CHANNELS = (['pos', 'look'] as const).map((key) =>
  [0, 1, 2].map((axis) => {
    const vals = SHOTS.map((s) => s[key][axis]);
    return { vals, tans: TIMES.map((_, i) => tangentAt(vals, TIMES, i)) };
  })
);

export type Sampled = { pos: number[]; look: number[] };

/** Sample the camera path at scrollProgress p into out.pos and out.look (plain arrays). */
export function samplePath(p: number, out: Sampled): void {
  const n = SHOTS.length;
  const clamped = Math.min(TIMES[n - 1], Math.max(TIMES[0], p));
  let i = 0;
  while (i < n - 2 && clamped >= TIMES[i + 1]) i++;
  const h = TIMES[i + 1] - TIMES[i];
  const s = segmentEase((clamped - TIMES[i]) / h);
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  for (let c = 0; c < 2; c++) {
    const target = c === 0 ? out.pos : out.look;
    for (let axis = 0; axis < 3; axis++) {
      const { vals, tans } = CHANNELS[c][axis];
      target[axis] = h00 * vals[i] + h10 * h * tans[i] + h01 * vals[i + 1] + h11 * h * tans[i + 1];
    }
  }
}

// Subtle pointer counter-drift during the phoenix beat: the camera offsets opposite the cursor by
// up to these world metres. Ramped by the phoenix engagement and gated by reduced motion.
export const POINTER_PARALLAX = { x: 0.18, y: 0.12, ease: 3.0 };

// Finale: the camera orbits the still-flying firebird a full 360 degrees and lands head-on at the
// end of the scroll. Scroll-driven, so it honours reduced motion.
export const FINALE = {
  from: 0.84, // the orbit engages here
  trackIn: 0.08, // scroll span to blend the orbit rig in from the exploration shot
  spinDelay: 0.02, // the spin waits this much scroll after `from` so the crane-out completes first
  follow: 8, // camera-settle speed during the finale (base 7)
  orbitTo: 0.97, // the 360 loop completes here, then holds the front view to 1.0
  orbitDist: 13, // camera distance from the bird while orbiting
  orbitHeight: 3.2, // camera height above the bird's centre
  frontOffset: 1.3, // radians: lands the camera in front of the beak, not the body's facing
};
