// The search shortcut (the 2026-10-10 polish, the command-palette convention): "/" or Ctrl+K (Cmd+K
// on a Mac) from any page focuses the search field, on /search/ in place and elsewhere by opening
// /search/#search, where the field takes focus. Never while typing in a field. Progressive: without
// JavaScript the header's Search link still opens the page.
export function setupSearchShortcut(): void {
  const field = (): HTMLInputElement | null => document.getElementById('search-input') as HTMLInputElement | null;
  if (location.hash === '#search') field()?.focus();
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey;
    const palette = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (!slash && !palette) return;
    event.preventDefault();
    const input = location.pathname === '/search/' ? field() : null;
    if (input) input.focus();
    else location.href = '/search/#search';
  });
}
