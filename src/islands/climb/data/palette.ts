// Tonal colour progression, ported verbatim from V1 (src/data/palette.js at v1.0.0-3d-experiment):
// night -> sunny. The climb begins in the dark and breaks into a brilliant sunny summit where the
// phoenix flies into the sun. Because the early stops are dark, the overlay text colour flips with
// the day (Climb.tsx writes --climb-ink and --climb-muted from dayAt) so copy stays readable.

export const SKY = [
  { at: 0.0, color: '#0e1526' }, // deep night: the trailhead in the dark
  { at: 0.18, color: '#1b2238' }, // night, the climb begins
  { at: 0.38, color: '#46415c' }, // first light, pre-dawn
  { at: 0.56, color: '#9a7560' }, // sunrise: warm light breaks
  { at: 0.74, color: '#d8b48c' }, // golden morning on the climb
  { at: 0.9, color: '#b9c2c8' }, // the sky opens: warm gives to cool
  { at: 1.0, color: '#8ab6e2' }, // brilliant sunny blue sky, so the white-fire phoenix pops
];

/** Day factor 0 (night) to 1 (day), crossing around the sunrise. */
export function dayAt(p: number): number {
  const t = Math.min(1, Math.max(0, (p - 0.4) / 0.22));
  return t * t * (3 - 2 * t);
}
