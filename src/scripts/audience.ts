// The audience picker (Home) and the footer Theme row (Profile Themes, 2026-10-10). The same map as
// theme-early.js (tests/skins.spec.ts holds all three in step). Stored on this device only.
const KEY = 'khaylub-audience';
const CLOSED = 'khaylub-picker-closed';
// The skin version token, written by scripts/build-skins.mjs (render.yaml caches /skins/* for a year).
const SKIN_V = '55751e4e1d';
const M: Record<string, [string, string]> = {hiring:['paper','lean'],tech:['desert-night','standard'],creative:['arizona-made','full'],exploring:['golden-hour','full'],youtube:['above-the-clouds','full'],nostalgia:['profile-2006','standard']};

// The skin names a visitor hears when the picker closes (Profile Themes spec, the six skins).
const NAME: Record<string, string> = {paper:'Paper','desert-night':'Desert Night','arizona-made':'Arizona Made','golden-hour':'Golden Hour','above-the-clouds':'Above the Clouds','profile-2006':'Profile 2006'};

const known = (id: string | null): id is string => id !== null && Object.prototype.hasOwnProperty.call(M, id);
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* the choice still applies to this page */ } };

let seq = 0;
function apply(id: string | null): void {
  const d = document.documentElement;
  const run = ++seq;
  document.querySelectorAll('link[data-skin-pending]').forEach((l) => l.remove());
  const old = document.getElementById('skin-css');
  if (!known(id)) { old?.remove(); delete d.dataset.audience; delete d.dataset.skin; delete d.dataset.tier; mark(null); return; }
  const [skin, tier] = M[id];
  d.dataset.audience = id; d.dataset.tier = tier;
  const done = () => {
    d.dataset.skin = skin; mark(id);
    document.dispatchEvent(new CustomEvent('audiencechange', { detail: { id, tier } }));
  };
  if (tier === 'lean') { old?.remove(); d.dataset.skin = skin; done(); return; }
  // The new link goes in first; the old one leaves, and data-skin changes (the skin files are keyed on
  // it), only once the new one has loaded or failed, so there is no flash of Paper between two skins.
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = `/skins/${skin}.css?v=${SKIN_V}`; l.dataset.skinPending = '';
  const swap = () => {
    if (run !== seq) return;
    old?.remove(); l.removeAttribute('data-skin-pending'); l.id = 'skin-css';
    done();
  };
  l.addEventListener('load', swap, { once: true });
  // A file that failed shows Paper: no tier, so the ending does not warm clips and Appearance stays live.
  l.addEventListener('error', () => { if (run === seq) delete d.dataset.tier; swap(); }, { once: true });
  document.head.appendChild(l);
}

function mark(id: string | null): void {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-row] [data-audience-choice]').forEach((b) => {
    if (b.dataset.audienceChoice !== 'reset') b.setAttribute('aria-pressed', String(b.dataset.audienceChoice === id));
  });
  fixedScheme();
}

// Spec section 4: Paper follows Appearance; every other skin is fixed dark or light, and the Appearance
// control says so. The note sits beside the buttons, which stay focusable but are marked aria-disabled
// (theme.ts ignores a press on them). A skin whose file failed to load has no tier, shows Paper, and
// leaves Appearance working.
function fixedScheme(): void {
  const group = document.querySelector<HTMLElement>('[data-appearance]');
  if (!group) return;
  const d = document.documentElement;
  const fixed = !!d.dataset.skin && d.dataset.skin !== 'paper' && !!d.dataset.tier && d.dataset.tier !== 'lean';
  let note = group.querySelector<HTMLElement>('[data-appearance-note]');
  if (fixed && !note) {
    note = document.createElement('span');
    note.className = 'small muted'; note.id = 'appearance-note'; note.dataset.appearanceNote = '';
    note.textContent = 'This theme sets its own colours.';
    group.append(note); group.setAttribute('aria-describedby', note.id);
  } else if (!fixed && note) { note.remove(); group.removeAttribute('aria-describedby'); }
  group.querySelectorAll('[data-theme-choice]').forEach((b) => (fixed ? b.setAttribute('aria-disabled', 'true') : b.removeAttribute('aria-disabled')));
}

export function setupAudience(): void {
  const picker = document.querySelector<HTMLElement>('[data-picker]');
  const stored = get(KEY);
  if (picker && !known(stored) && get(CLOSED) !== '1') picker.hidden = false;
  mark(known(stored) ? stored : null);
  const row = document.querySelector<HTMLElement>('[data-theme-row]');
  if (row) row.hidden = false;
  // The early script's skin file may still be loading; if it fails (theme-early.js drops the tier), refresh.
  document.getElementById('skin-css')?.addEventListener('error', () => fixedScheme());
  // Closing the picker hides the button that had focus, so focus moves to the cover heading (a stable
  // target just above it) and a visually hidden status line, outside the picker, says what happened.
  let status: HTMLElement | null = null;
  if (picker) { status = document.createElement('p'); status.className = 'visually-hidden'; status.setAttribute('role', 'status'); status.dataset.pickerStatus = ''; picker.after(status); }
  const settle = (message: string) => {
    const h = document.querySelector<HTMLElement>('#site-name') ?? document.querySelector<HTMLElement>('h1');
    if (h) { h.tabIndex = -1; h.focus(); }
    if (status) status.textContent = message;
  };

  // A page restored from the back/forward cache, or another tab that changes the answer, re-reads the
  // stored answer: the skin, the Theme row and the picker follow it.
  const sync = () => {
    const s = get(KEY);
    const want = known(s) ? s : null;
    if (want !== (document.documentElement.dataset.audience ?? null)) apply(want); else mark(want);
    if (picker) picker.hidden = known(s) || get(CLOSED) === '1';
  };
  window.addEventListener('pageshow', (e) => { if (e.persisted) sync(); });
  window.addEventListener('storage', (e) => { if (e.key === null || e.key === KEY || e.key === CLOSED) sync(); });

  document.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-audience-choice],[data-picker-close]');
    if (!t) return;
    const inPicker = !!picker && picker.contains(t);
    if (t.hasAttribute('data-picker-close')) {
      put(CLOSED, '1'); if (picker) picker.hidden = true;
      if (inPicker) settle('No theme chosen. You can pick one in the footer.');
      return;
    }
    const id = t.dataset.audienceChoice!;
    if (id === 'reset') { put(KEY, null); apply(null); } else { put(KEY, id); apply(id); }
    if (picker) picker.hidden = true;
    if (inPicker && known(id)) settle(`Theme set to ${NAME[M[id][0]]}. Change it any time in the footer.`);
  });
}
