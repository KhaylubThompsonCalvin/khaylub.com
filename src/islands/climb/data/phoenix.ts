// Phoenix choreography ("Spark of the Summit"), ported verbatim from V1 (src/data/phoenix.js at
// v1.0.0-3d-experiment). The phoenix is a secondary accent: a faint ember that wakes near the
// midpoint, arcs through the far background behind the Wanderer, and resolves into fire at the
// summit. Choreography-as-data; PhoenixFlap.tsx samples it by scrollProgress and never re-renders.
// World frame: the Wanderer is fixed at the origin, about 1 m tall, facing +X.

export const PHOENIX = {
  spark: 0.5, // ember fades in here
  rampFrom: 0.5, // emission and flap-speed ramp start
  rampTo: 0.98, // ...and finish; the fire peak then holds through the close
  emergeSpan: 0.04, // quick fade and scale-in so the spark ignites rather than popping on
};

// Philosophy foreshadow: the spark is felt before it is seen, as a shadow pool sweeping over the
// lit grass and across the Wanderer from ahead to behind.
export const FORESHADOW = {
  from: 0.12,
  peak: 0.21,
  to: 0.34,
  maxOpacity: 0.6,
  xFrom: 3.4,
  xTo: -4.2,
  z: 0.1,
  size: 3.4,
};

export type FlightPoint = { at: number; pos: [number, number, number] };

// Flight path: keyframed world positions sampled with a Catmull-Rom curve.
export const FLIGHT: FlightPoint[] = [
  { at: 0.5, pos: [-1.46, 0.33, -10.25] }, // spark: ignites into the upper-right of frame
  { at: 0.57, pos: [-4.8, 1.1, -6.6] }, // sweeps in, upper-right: a visible firebird arriving
  { at: 0.66, pos: [-7.6, 1.2, -2.2] }, // arcs across frame, kept low so it stays in shot
  { at: 0.77, pos: [-8.6, 1.5, 1.4] }, // the wide point of the arc
  { at: 0.86, pos: [-7.6, 3.2, 2.8] }, // banks back toward him; the ascent steepens
  { at: 0.93, pos: [-5.4, 5.8, 3.0] }, // up and over toward the Wanderer
  { at: 1.0, pos: [-3.2, 7.8, 2.6] }, // summit: flies up and over him, climbing high
];

// The firebird's shadow sweeping over the Wanderer during the overhead pass.
export const SHADOW = {
  from: 0.5,
  peak: 0.57,
  to: 0.72,
  maxOpacity: 0.55,
  baseSize: 1.4,
  sizePerHeight: 0.3,
  softnessHeight: 8,
  highFade: 0.45,
};

// Emission ramp: ember glow -> fire.
export const EMBER_INTENSITY = 1.0;
export const FIRE_INTENSITY = 2.8;
export const EMBER_COLOR = '#ff5a1e';
export const FIRE_COLOR = '#ffb24a';
export const BODY_EMBER = 0.22;
export const BODY_FIRE = 0.6;

export const GLIDE_PITCH = 0.22;
export const FLAP_SLOW = 0.6;
export const FLAP_FAST = 1.6;
export const FREEZE_FROM = 0.96;
export const FREEZE_POSE_TIME = 0.2;
export const SCALE_MIN = 1.5;
export const SCALE_MAX = 3.0;
export const HEADING_OFFSET = 0;

export const BLOOM = { strength: 0.75, radius: 0.5, threshold: 0.5 };

export const FEATHERS = {
  from: 0.88,
  fadeSpan: 0.07,
  count: 12,
  size: 1.0,
  fall: 0.5,
  sway: 0.6,
  spin: 0.5,
  spread: 3.2,
  drop: 7,
  color: '#ffd49a',
};

export const POINTER = {
  drift: [1.8, 1.1] as [number, number],
  bank: 0.5,
  yaw: 0.35,
  ease: 3.2,
  emberBoost: 1.8,
};

export const SCROLL_FLAIR = {
  ref: 18,
  emberBoost: 1.4,
  flapBoost: 0.8,
  ease: 5.0,
};

export const FINALE_REVEAL = {
  from: 0.965,
  full: 1.0,
  flareColor: '#fff3da',
  flareSize: 4.0,
  flarePeak: 0.5,
  flareHold: 0.26,
  breath: 0.05,
  emberCount: 30,
  emberColor: '#ffc46a',
  emberSize: 0.5,
  burstRadius: 4.5,
  rise: 1.8,
  bob: 0.18,
};

export const SUMMIT_INTERACT = {
  from: 0.9,
  scaleBoost: 1.4,
  drift: [3.4, 2.2] as [number, number],
  yaw: 0.55,
  bank: 0.4,
  emberBoost: 2.0,
  flapWake: 1.1,
  hoverSwayX: 0.18,
  hoverSwayY: 0.15,
};

export const TRAIL = {
  from: 0.5,
  fadeSpan: 0.05,
  count: 18,
  sampleDt: 0.035,
  size: 0.7,
  baseOpacity: 0.55,
  color: '#ff9a4a',
};
