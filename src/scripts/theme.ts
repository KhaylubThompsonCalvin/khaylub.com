// The Appearance control (F4, vault document 64): Light, Dark, or System. Astro bundles this as an
// external module script (no inline script, so the Content Security Policy stays strict). The
// choice is stored on this device only (localStorage, guarded for private windows); System removes
// the stored override and returns control to prefers-color-scheme. The early head script
// (theme-early.js) applies a stored choice before first paint; this module wires the buttons and
// keeps aria-pressed and the theme-color metas in step. It is bundled with the nav disclosure into
// the site's one module script (src/scripts/site.ts).
const KEY = 'khaylub-theme';
type Choice = 'light' | 'dark' | 'system';

function stored(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(choice: Choice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  // The browser chrome follows the active scheme: the media-qualified metas serve System; a pinned
  // scheme gets the matching value on both so the browser cannot pick the other.
  const dark = choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const active = dark ? '#15120d' : '#ece4d8';
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const media = m.getAttribute('media');
    if (choice === 'system') m.content = media?.includes('dark') ? '#15120d' : '#ece4d8';
    else m.content = active;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === choice)));
}

export function setupTheme(): void {
  const group = document.querySelector('[data-appearance]');
  if (!group) return;
  apply(stored());
  group.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-theme-choice]');
    if (!button) return;
    const choice = button.dataset.themeChoice as Choice;
    try {
      if (choice === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      /* no storage: the choice still applies to this page */
    }
    apply(choice);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => apply(stored()));
}

