// The climb island root, ported from V1's App.jsx (khaylub-portfolio, tag v1.0.0-3d-experiment)
// as a block inside a V2 page rather than a page of its own. The stage (canvas and plates) is
// sticky for one viewport inside a track whose height is the six beats; the overlay scrolls over
// it. Progress is measured from the track's own top edge (scroll.ts), so the V2 header, footer,
// and the rest of the page are untouched. V2's door is the gesture (no in-island gate); the exit
// is always visible (P2-FE-08). V1's nav, audio manager, and the case-study dialog are gone.
import { useEffect, useRef } from 'react';
import Scene from './three/Scene';
import VideoPlate from './ui/VideoPlate';
import { Hero, Philosophy, Footholds, Spark, Contact, type ContactLink } from './ui/Beats';
import Camps from './ui/Camps';
import { attachScroll } from './scroll';
import { store, useStore } from './store';
import { dayAt } from './data/palette';

export type ClimbProps = {
  name: string;
  roleLine: string;
  availability: string;
  links: ContactLink[];
  onSkip: () => void;
};

const NAV_BAND = 130; // px: copy travelling up under the sticky header fades out at the top edge

export function Climb({ name, roleLine, availability, links, onSkip }: ClimbProps) {
  const root = useRef<HTMLElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  const reachedStageIndex = useStore((s) => s.reachedStageIndex);
  const ready = useStore((s) => s.ready);
  const started = useStore((s) => s.started);

  // The scroll spine over the island's own track; focus lands on the hero once the tree is committed
  // (an effect, not a frame callback: React 19 may commit this tree later than the next frame).
  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    store.start();
    root.current?.querySelector<HTMLElement>('[data-climb-focus]')?.focus();
    return attachScroll(el);
  }, []);

  // Night -> day chrome from scroll, written as CSS variables on the island root only (never on
  // <html>, where V2's own --ink and --muted tokens live): text flips light to dark with the day,
  // the scrim tracks the sky tone, and --climb-fire lights the closing links with the phoenix.
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
    const topFade = Array.from(el.querySelectorAll<HTMLElement>('[data-beat="arrival"] .inner, [data-beat="philosophy"] .inner, [data-beat="focus"] .inner, [data-beat="spark"] .inner'));
    const apply = (p: number) => {
      const day = dayAt(p);
      for (const block of topFade) {
        const top = block.getBoundingClientRect().top;
        if (top < NAV_BAND) block.style.opacity = String(Math.max(0, top / NAV_BAND));
        else if (block.style.opacity !== '') block.style.opacity = '';
      }
      el.style.setProperty('--climb-ink', `rgb(${mix(236, 36, day)},${mix(230, 28, day)},${mix(218, 18, day)})`);
      el.style.setProperty('--climb-muted', `rgb(${mix(168, 91, day)},${mix(160, 81, day)},${mix(146, 63, day)})`);
      el.style.setProperty('--climb-scrim', `${mix(14, 236, day)},${mix(18, 232, day)},${mix(32, 224, day)}`);
      const fire = Math.min(1, Math.max(0, (p - 0.8) / 0.18));
      el.style.setProperty('--climb-fire', (fire * fire * (3 - 2 * fire)).toFixed(3));
    };
    apply(store.getState().scrollProgress);
    return store.subscribe((s) => apply(s.scrollProgress));
  }, []);

  // Mirror the OS reduced-motion preference into the store.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => store.setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Mirror the pointer (-1..1) for the phoenix parallax; frame loops gate it by reduced motion.
  useEffect(() => {
    const onMove = (e: PointerEvent) => store.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    const recenter = () => store.setPointer(0, 0);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('blur', recenter);
    document.addEventListener('pointerleave', recenter);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', recenter);
      document.removeEventListener('pointerleave', recenter);
    };
  }, []);

  return (
    <section className="climb" aria-label="The climb" ref={root}>
      <div className="climb-exit">
        <p className="climb-status" role="status">
          {ready ? '' : 'Loading the climb: two models and four short video plates.'}
        </p>
        <button type="button" className="climb-skip" onClick={onSkip}>
          Skip the climb
        </button>
      </div>

      <div className="climb-track" ref={track}>
        <div className="climb-stage" aria-hidden="true">
          <Scene />
          {/* Ground fog through the dark opening beats, mounted first so it sits beneath the others. */}
          <VideoPlate src="/climb/fog-trail.mp4" blend="soft-light" max={0.4} fadeIn={[0, 0.05]} fadeOut={[0.22, 0.3]} scrub={[0, 0.21]} anchor="bottom" feather="top" />
          {started && <VideoPlate src="/climb/dawn-grass.mp4" blend="soft-light" max={0.45} fadeIn={[0, 0.06]} fadeOut={[0.3, 0.45]} />}
          <VideoPlate src="/climb/embers.mp4" blend="screen" max={0.7} fadeIn={[0.46, 0.58]} deferUntil={0.38} />
          <VideoPlate src="/climb/summit-clouds.mp4" blend="soft-light" max={0.4} fadeIn={[0.82, 0.92]} scrub={[0.82, 0.97]} deferUntil={0.74} />
        </div>

        <div className="climb-overlay" data-reached={reachedStageIndex}>
          <Hero name={name} roleLine={roleLine} />
          <Philosophy />
          <Footholds />
          <Spark />
          <Camps />
          <Contact availability={availability} links={links} />
        </div>
      </div>
    </section>
  );
}
