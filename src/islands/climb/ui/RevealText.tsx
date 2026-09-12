// Cinematic per-word scroll reveal, ported from V1 (src/ui/RevealText.jsx): each word sharpens
// (blur, fade, lift) in sequence as the visitor scrolls through its beat. Reads scroll through the
// store's subscribe (no React re-render) and writes word styles through the CSSOM. Under
// prefers-reduced-motion every word renders solid with no scroll coupling.
import { useEffect, useMemo, useRef, createElement } from 'react';
import { store, useStore } from '../store';
import { STAGES, localProgress, type StageId } from '../data/stages';

type Props = {
  text: string;
  stageId: StageId;
  from?: number;
  to?: number;
  className?: string;
  as?: 'p' | 'h2';
  intensity?: number;
  warm?: boolean;
};

export default function RevealText({ text, stageId, from = 0, to = 0.45, className, as = 'p', intensity = 1, warm = false }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const stage = useMemo(() => STAGES.find((s) => s.id === stageId), [stageId]);
  const words = useMemo(() => text.split(' '), [text]);

  useEffect(() => {
    const spans = ref.current?.querySelectorAll<HTMLElement>('.reveal-word');
    if (!spans?.length) return;

    if (reducedMotion) {
      spans.forEach((el) => {
        el.style.opacity = '1';
        el.style.filter = 'none';
        el.style.transform = 'none';
        el.style.color = warm ? 'rgb(36, 28, 18)' : '';
      });
      return;
    }

    const apply = (p: number) => {
      const lp = stage ? localProgress(p, stage) : Math.min(1, Math.max(0, p));
      const span = to - from || 1;
      const r = Math.min(1, Math.max(0, (lp - from) / span));
      for (let i = 0; i < spans.length; i++) {
        const start = (i / spans.length) * 0.6;
        const t = Math.min(1, Math.max(0, (r - start) / 0.4));
        const e = 1 - (1 - t) ** 3;
        const el = spans[i];
        el.style.opacity = (0.08 + 0.92 * e).toFixed(3);
        el.style.filter = e < 0.999 ? `blur(${((1 - e) * 6 * intensity).toFixed(2)}px)` : 'none';
        el.style.transform = e < 0.999 ? `translateY(${((1 - e) * 0.5 * intensity).toFixed(3)}em)` : 'none';
        if (warm) {
          const c = (a: number, b: number) => Math.round(a + (b - a) * e);
          el.style.color = `rgb(${c(176, 36)}, ${c(122, 28)}, ${c(58, 18)})`;
        }
      }
    };

    apply(store.getState().scrollProgress);
    return store.subscribe((s, prev) => {
      if (s.scrollProgress !== prev.scrollProgress) apply(s.scrollProgress);
    });
  }, [reducedMotion, stage, from, to, words.length, intensity, warm]);

  return createElement(
    as,
    { ref, className },
    words.map((w, i) => (
      <span key={i}>
        <span className="reveal-word">{w}</span>
        {i < words.length - 1 ? ' ' : ''}
      </span>
    ))
  );
}
