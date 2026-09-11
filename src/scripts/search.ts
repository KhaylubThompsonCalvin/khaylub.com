// Static search (P2-CE-16, P2-FE-30). The Pagefind index is built from dist/ after the build and
// served from this origin. Nothing loads until the visitor types; the fallback links on the page
// stay for visitors without JavaScript. No inline styles: classes come from the stylesheet.
type PagefindResult = { data: () => Promise<{ url: string; excerpt: string; meta: Record<string, string> }> };
type Pagefind = { init: () => Promise<void>; search: (q: string) => Promise<{ results: PagefindResult[] }> };

function setup(): void {
  const form = document.getElementById('search-form') as HTMLFormElement | null;
  const input = document.getElementById('search-input') as HTMLInputElement | null;
  const status = document.getElementById('search-status');
  const list = document.getElementById('search-results');
  if (!form || !input || !status || !list) return;

  let pagefind: Pagefind | null = null;
  let timer: number | undefined;
  let latest = 0;

  const load = async (): Promise<Pagefind> => {
    if (pagefind) return pagefind;
    // The index lives outside the bundle (written by pagefind after the build), so the specifier is
    // computed to keep Vite and the type checker from resolving it at build time.
    const specifier = '/pagefind/pagefind.js';
    const mod = (await import(/* @vite-ignore */ specifier)) as Pagefind;
    await mod.init();
    pagefind = mod;
    return mod;
  };

  const render = (items: { url: string; excerpt: string; meta: Record<string, string> }[], q: string) => {
    list.replaceChildren();
    for (const item of items) {
      const li = document.createElement('li');
      const head = document.createElement('p');
      head.className = 'result-head';
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = item.meta.collection ?? '';
      const link = document.createElement('a');
      link.href = new URL(item.url, location.origin).pathname;
      link.textContent = item.meta.title ?? item.url;
      const date = document.createElement('span');
      date.className = 'small muted';
      date.textContent = item.meta.date ?? '';
      head.append(badge, ' ', link, ' ', date);
      const excerpt = document.createElement('p');
      excerpt.className = 'small muted result-excerpt';
      // The excerpt is Pagefind's text from this site's own indexed pages with <mark> around hits.
      excerpt.innerHTML = item.excerpt;
      li.append(head, excerpt);
      list.append(li);
    }
    status.textContent = `${items.length} ${items.length === 1 ? 'result' : 'results'} for ${q}`;
  };

  const run = async () => {
    const q = input.value.trim();
    const id = ++latest;
    if (q.length < 2) {
      list.replaceChildren();
      status.textContent = '';
      return;
    }
    status.textContent = 'Searching';
    try {
      const pf = await load();
      const { results } = await pf.search(q);
      const items = await Promise.all(results.slice(0, 20).map((r) => r.data()));
      if (id === latest) render(items, q);
    } catch {
      // The index is missing (a dev session without a build) or blocked; the browse links below still work.
      if (id === latest) status.textContent = 'Search is unavailable right now. Browse by collection, tag, or date below.';
    }
  };

  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 150);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    window.clearTimeout(timer);
    void run();
  });

  // A shared or bookmarked /search/?q=... (and the no-JavaScript form submit) runs once on load.
  const initial = new URLSearchParams(location.search).get('q');
  if (initial) {
    input.value = initial;
    void run();
  }
}

setup();

export {};
