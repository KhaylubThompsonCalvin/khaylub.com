// Loaded only after "Enter the climb" is activated. At Phase 9 this is a labeled stub that
// proves the on-demand path; the ported V1 scene replaces the placeholder at Phase 13.
import { createRoot, type Root } from 'react-dom/client';
import { ClimbIsland } from './ClimbIsland';

const roots = new WeakMap<HTMLElement, Root>();

export function mountClimb(container: HTMLElement, onSkip: () => void): void {
  const existing = roots.get(container);
  if (existing) return;
  const root = createRoot(container);
  roots.set(container, root);
  root.render(
    <ClimbIsland
      onSkip={() => {
        root.unmount();
        roots.delete(container);
        container.replaceChildren();
        onSkip();
      }}
    />
  );
  container.querySelector<HTMLElement>('[data-climb-focus]')?.focus();
}
