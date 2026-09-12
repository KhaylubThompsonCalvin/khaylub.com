// The six-beat scroll timeline, ported verbatim from V1 (src/data/stages.js at v1.0.0-3d-experiment).
// Each beat owns a slice of scrollProgress (0..1), weighted unequally so big beats get more room.
// Every system (camera, character, atmosphere, overlay) reads from these ranges.

export const STAGES = [
  { id: 'arrival', label: 'The Trailhead', from: 0.0, to: 0.12 },
  { id: 'philosophy', label: 'The First Ember', from: 0.12, to: 0.3 },
  { id: 'focus', label: 'Footholds', from: 0.3, to: 0.48 },
  { id: 'spark', label: 'The Spark Wakes', from: 0.48, to: 0.58 },
  { id: 'camps', label: 'The Camps', from: 0.58, to: 0.88 },
  { id: 'contact', label: 'The Summit', from: 0.88, to: 1.0 },
] as const;

export type Stage = (typeof STAGES)[number];
export type StageId = Stage['id'];

// Total scroll height of the experience in viewport-heights: the story sections
// (84 + 126 + 126 + 70 + 210 = 616vh) plus a 184vh summit sky tail = 800vh. Kept equal to the sum of
// the section min-heights in climb.css.
export const SCROLL_VH = 800;

// Fraction of the track that plays the STORY (the walk, the flight, the camera spinning to the
// head-on front view). The remaining part is the held sky tail: scroll.ts clamps scrollProgress to
// 1 there, so the camera holds the front view and the still-flying firebird becomes the sky the
// closing copy scrolls over.
export const STORY_FRAC = 0.86;

export function stageAt(p: number): Stage {
  return STAGES.find((s) => p >= s.from && p < s.to) ?? STAGES[STAGES.length - 1];
}

/** Local 0..1 progress within a stage. */
export function localProgress(p: number, stage: Stage): number {
  const span = stage.to - stage.from || 1;
  return Math.min(1, Math.max(0, (p - stage.from) / span));
}
