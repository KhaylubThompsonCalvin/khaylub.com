// The returning header (Jakob's Law: the pattern long pages on the web already use). Reading down
// past one viewport, the sticky header steps out of the way; any scroll up brings it back at once.
// It never hides while the mobile menu is open or anything in the header has focus, and under
// reduced motion it stays a plain sticky header. The motion is the --ease token in SiteHeader.
export function setupHeaderScroll(): void {
  const header = document.getElementById('site-header');
  if (!header || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const menu = document.getElementById('primary-nav-button');
  let last = window.scrollY;
  let ticking = false;

  const show = (): void => header.removeAttribute('data-hidden');
  const update = (): void => {
    ticking = false;
    const y = window.scrollY;
    const busy = menu?.getAttribute('aria-expanded') === 'true' || header.contains(document.activeElement);
    if (y < last || busy || y <= window.innerHeight) show();
    else if (y > last) header.setAttribute('data-hidden', '');
    last = y;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  // Focus moving down the page scrolls it before the scroll event arrives: settle the header at
  // once so it never covers the newly focused control. Focus inside the header always shows it.
  document.addEventListener('focusin', update);
}
