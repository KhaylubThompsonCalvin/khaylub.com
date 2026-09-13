// Loaded only after "Enter the climb" or "Tap to explore" is activated (ClimbDoor.astro imports
// this module on click, never before). Links the island's own stylesheet, reads the profile facts
// the door carries as data attributes, and mounts the ported V1 scene; "Skip the climb" unmounts
// it and hands focus back to the door.
import { createRoot, type Root } from 'react-dom/client';
import { Climb } from './climb/Climb';
import { store } from './climb/store';
import cssUrl from './climb/climb.css?url';

const roots = new WeakMap<HTMLElement, Root>();

function ensureStylesheet(): void {
  if (document.querySelector('link[data-climb-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssUrl;
  link.dataset.climbCss = '';
  document.head.appendChild(link);
}

export function mountClimb(container: HTMLElement, door: HTMLElement, onSkip: () => void): void {
  if (roots.get(container)) return;
  ensureStylesheet();
  const d = door.dataset;
  const links = [
    { label: 'GitHub', href: d.github ?? '' },
    { label: 'LinkedIn', href: d.linkedin ?? '' },
    { label: 'Email', href: d.email ? `mailto:${d.email}` : '' },
    { label: 'Résumé', href: d.resume ?? '' },
  ].filter((l) => l.href);

  store.reset();
  const root = createRoot(container);
  roots.set(container, root);
  root.render(
    <Climb
      name={d.name ?? ''}
      roleLine={d.role ?? ''}
      availability={d.availability ?? ''}
      links={links}
      onSkip={() => {
        root.unmount();
        roots.delete(container);
        container.replaceChildren();
        onSkip();
      }}
    />
  );
}
