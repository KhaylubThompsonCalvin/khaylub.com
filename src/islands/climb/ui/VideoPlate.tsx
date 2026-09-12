// A Higgsfield atmosphere plate washed over the live scene, ported from V1
// (src/ui/VideoAtmosphere.jsx): a muted loop whose opacity is driven by scroll so it fades in and
// out with its beat. Under prefers-reduced-motion it is paused and hidden. A plate whose beat is
// deep in the scroll arms (gets its src) only once scroll crosses `deferUntil`. These plates are
// the one place a muted loop is allowed (ADR-007): short, inside the opted-in climb, never on the
// entry path, and never under reduced motion.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { store, useStore } from '../store';

type Props = {
  src: string;
  blend?: CSSProperties['mixBlendMode'];
  max?: number;
  fadeIn?: [number, number];
  fadeOut?: [number, number];
  scrub?: [number, number];
  anchor?: 'bottom';
  feather?: 'top';
  deferUntil?: number;
};

export default function VideoPlate({ src, blend = 'soft-light', max = 0.45, fadeIn = [0, 0.06], fadeOut, scrub, anchor, feather, deferUntil }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const [armed, setArmed] = useState(deferUntil == null);

  useEffect(() => {
    if (armed || deferUntil == null) return undefined;
    if (store.getState().scrollProgress > deferUntil) {
      setArmed(true);
      return undefined;
    }
    return store.subscribe((s) => {
      if (s.scrollProgress > deferUntil) setArmed(true);
    });
  }, [armed, deferUntil]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !armed) return undefined;
    if (reducedMotion) {
      v.pause();
      v.style.opacity = '0';
      return undefined;
    }
    const ramp = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a || 1)));
    const apply = (p: number) => {
      let o = ramp(p, fadeIn[0], fadeIn[1]);
      if (fadeOut) o *= 1 - ramp(p, fadeOut[0], fadeOut[1]);
      v.style.opacity = (o * max).toFixed(3);
      if (scrub && v.duration) v.currentTime = ramp(p, scrub[0], scrub[1]) * (v.duration - 0.05);
    };
    apply(store.getState().scrollProgress);
    const unsub = store.subscribe((s, prev) => {
      if (s.scrollProgress !== prev.scrollProgress) apply(s.scrollProgress);
    });
    if (scrub) v.pause();
    else v.play?.().catch(() => {});
    return unsub;
  }, [reducedMotion, fadeIn, fadeOut, max, scrub, armed]);

  const style: CSSProperties = { mixBlendMode: blend };
  if (anchor === 'bottom') style.objectPosition = 'center bottom';
  if (feather === 'top') {
    const g = 'linear-gradient(to bottom, transparent 0%, transparent 42%, rgba(0,0,0,0.6) 64%, #000 82%)';
    style.maskImage = g;
    style.WebkitMaskImage = g;
  }

  return <video ref={ref} className="climb-plate" style={style} src={armed ? src : undefined} muted loop playsInline preload={armed ? 'auto' : 'none'} aria-hidden="true" />;
}
