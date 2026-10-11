// The ending band (Profile Themes, 2026-10-10). Upgrades the two answer links to buttons, plays one
// clip at a time, never loads a clip under reduced motion or Data Saver, and on the Full tier warms
// the clips when the band nears the screen. Nothing is recorded or sent.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
const arm = (v: HTMLVideoElement) => { if (v.dataset.armed) return; v.querySelectorAll<HTMLSourceElement>('source[data-src]').forEach((s) => (s.src = s.dataset.src!)); v.preload = 'auto'; if (v.dataset.poster) v.poster = v.dataset.poster; v.load(); v.dataset.armed = '1'; };

export function setupEnding(): void {
  const band = document.querySelector<HTMLElement>('[data-ending]');
  if (!band) return;
  const vids = [...band.querySelectorAll<HTMLVideoElement>('video.ending-clip')];
  const show = (state: '' | 'yes' | 'no') => {
    if (state) band.dataset.state = state; else delete band.dataset.state;
    vids.forEach((v) => v.pause());
    if (!state) { band.querySelector<HTMLElement>('#ending-heading')?.focus(); return; }
    const clip = vids.find((v) => v.dataset.clip === (state === 'yes' ? 'harvest' : 'trials'))!;
    if (!reduced()) { arm(clip); clip.currentTime = 0; clip.play().catch(() => {}); }
    band.querySelector<HTMLElement>(state === 'yes' ? '#thanks h2' : '#goodbye h2')?.focus();
  };
  band.querySelectorAll<HTMLAnchorElement>('[data-answer]').forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = a.className; b.textContent = a.textContent; b.dataset.answer = a.dataset.answer;
    b.addEventListener('click', () => show(a.dataset.answer === 'yes' ? 'yes' : 'no'));
    a.replaceWith(b);
  });
  band.querySelectorAll('#thanks .ending-answers, #goodbye .ending-answers').forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-on-image'; b.textContent = 'Start over';
    b.addEventListener('click', () => show(''));
    p.appendChild(b);
  });
  // Arriving with #thanks or #goodbye (a shared or reloaded address): the state takes over from :target,
  // and the fragment is dropped so Start over can show the question again.
  const hash = location.hash;
  if (hash === '#thanks' || hash === '#goodbye') {
    band.dataset.state = hash === '#thanks' ? 'yes' : 'no';
    history.replaceState(history.state, '', location.pathname + location.search);
  }
  const warm = () => {
    if (document.documentElement.dataset.tier !== 'full' || reduced()) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { vids.forEach(arm); io.disconnect(); } }, { rootMargin: '600px 0px' });
    io.observe(band);
  };
  warm();
  document.addEventListener('audiencechange', warm);
}
