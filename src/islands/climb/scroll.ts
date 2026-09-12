// The scroll spine: window scroll over the island's own track becomes scrollProgress in the store.
// V1 drove this from Lenis (src/scroll/useScrollSetup.js); under prefers-reduced-motion V1 already
// let the browser scroll natively and only tracked position, and that is the path ported here for
// every visitor, because `lenis` is not named in an ADR (the owner decides whether it returns).
// The track is a normal block inside the V2 page, so progress is measured from its own top edge,
// never from the document, and the professional page around it is untouched.
import { store } from './store';
import { STORY_FRAC } from './data/stages';

export function attachScroll(track: HTMLElement): () => void {
  let raf = 0;
  let lastY = window.scrollY;
  let lastT = performance.now();
  let velocity = 0;

  // Map the track's scroll to STORY progress. The whole choreography plays across the first
  // STORY_FRAC of the track; past that scrollProgress is held at 1 so the front-on firebird becomes
  // the held sky the closing copy scrolls over (V1's stages.js explains the split).
  const read = () => {
    const rect = track.getBoundingClientRect();
    const total = Math.max(1, track.offsetHeight - window.innerHeight);
    const raw = Math.min(1, Math.max(0, -rect.top / total));
    store.setScrollProgress(Math.min(1, raw / STORY_FRAC));
  };

  window.addEventListener('scroll', read, { passive: true });
  window.addEventListener('resize', read);

  // Velocity in pixels per 16 ms frame (the scale V1 tuned the phoenix's scroll flair against),
  // read from the frame loop so it decays to zero on its own when scrolling stops.
  const loop = (t: number) => {
    const y = window.scrollY;
    const dt = Math.max(1, t - lastT);
    const instant = ((y - lastY) / dt) * 16;
    velocity += (instant - velocity) * 0.3;
    if (Math.abs(velocity) < 0.01) velocity = 0;
    store.setScrollVelocity(velocity);
    lastY = y;
    lastT = t;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  read();

  return () => {
    window.removeEventListener('scroll', read);
    window.removeEventListener('resize', read);
    cancelAnimationFrame(raf);
  };
}
