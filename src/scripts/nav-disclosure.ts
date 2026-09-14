// Mobile menu disclosure. Astro bundles this as an external module script (no inline script),
// which keeps the Content Security Policy strict. Behavior: the button toggles aria-expanded;
// Escape closes and returns focus to the button; clicking outside closes; no focus trap.
function setup(): void {
  const button = document.getElementById('primary-nav-button');
  const list = document.getElementById('primary-nav-list');
  if (!button || !list) return;

  const setOpen = (open: boolean): void => {
    button.setAttribute('aria-expanded', String(open));
    list.dataset.open = String(open);
  };

  button.addEventListener('click', () => {
    setOpen(button.getAttribute('aria-expanded') !== 'true');
  });

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      button.focus();
    }
  });

  document.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (!target) return;
    if (button.contains(target) || list.contains(target)) return;
    if (button.getAttribute('aria-expanded') === 'true') setOpen(false);
  });
}

setup();

export {};
