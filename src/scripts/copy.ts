// Copy buttons (the 2026-10-10 polish): a button with data-copy="<text>" ships hidden, because it can
// only work with JavaScript; this shows it and copies its text, saying so in its own label for a
// moment (a link with data-copy works too). Without JavaScript the text it copies is on the page as plain text.
export function setupCopy(): void {
  for (const button of document.querySelectorAll<HTMLElement>('[data-copy]')) {
    if (!navigator.clipboard) continue;
    const label = button.textContent;
    button.hidden = false;
    button.addEventListener('click', async (e) => {
      if (button instanceof HTMLAnchorElement) e.preventDefault(); // a link copies instead of navigating
      await navigator.clipboard.writeText(button.dataset.copy ?? '');
      button.textContent = 'Copied';
      window.setTimeout(() => (button.textContent = label), 2000);
    });
  }
}
