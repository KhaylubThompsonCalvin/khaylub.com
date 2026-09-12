// The climb's single source of truth. Scroll writes scrollProgress; every system reads it. Ported
// from V1's zustand store (khaylub-portfolio, tag v1.0.0-3d-experiment, src/store/useExperience.js)
// onto a forty-line store, because zustand is not named in any ADR. Frame loops read getState();
// React components subscribe to primitives only, so the scene never re-renders per frame.
import { useSyncExternalStore } from 'react';
import { STAGES, stageAt, type StageId } from './data/stages';

// The phoenix's live world position. PhoenixFlap mutates this object in place each frame (no
// setState, no notification) and CameraRig reads it to orbit the bird in the finale. x/y/z = the
// pivot; cy = the visual-centre Y; fx/fz = the base facing (scroll heading without pointer yaw).
export type PhoenixPos = { x: number; y: number; z: number; cy: number; fx: number; fz: number };

export type State = {
  started: boolean; // true once the island is mounted (the V2 door is the gesture)
  ready: boolean; // true once the Wanderer GLB has loaded
  reducedMotion: boolean; // mirror of prefers-reduced-motion
  scrollProgress: number; // 0 to 1 across the story
  stageId: StageId; // current beat, derived on write
  reachedStageIndex: number; // furthest beat ever reached; monotonic, drives reveal-and-stay
  pointerX: number; // -1 (left) to 1 (right)
  pointerY: number; // -1 (bottom) to 1 (top)
  scrollVelocity: number; // pixels per frame, decays to 0 when idle
  phoenixPos: PhoenixPos;
};

type Listener = (state: State, prev: State) => void;

const initial = (): State => ({
  started: false,
  ready: false,
  reducedMotion: false,
  scrollProgress: 0,
  stageId: STAGES[0].id,
  reachedStageIndex: 0,
  pointerX: 0,
  pointerY: 0,
  scrollVelocity: 0,
  phoenixPos: { x: 0, y: 0, z: 0, cy: 0, fx: 0, fz: 1 },
});

let state: State = initial();
const listeners = new Set<Listener>();

function setState(partial: Partial<State>): void {
  const prev = state;
  state = { ...prev, ...partial };
  for (const listener of listeners) listener(state, prev);
}

export const store = {
  getState: (): State => state,
  setState,
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Fresh state for a new mount (the island can be entered, skipped, and entered again). */
  reset(): void {
    state = initial();
  },
  start: () => setState({ started: true }),
  setReady: (ready: boolean) => setState({ ready }),
  setReducedMotion: (reducedMotion: boolean) => setState({ reducedMotion }),
  setPointer: (pointerX: number, pointerY: number) => setState({ pointerX, pointerY }),
  setScrollVelocity(v: number): void {
    if (v !== state.scrollVelocity) setState({ scrollVelocity: v });
  },
  setScrollProgress(p: number): void {
    const clamped = Math.min(1, Math.max(0, p));
    const stage = stageAt(clamped);
    const reached = Math.max(state.reachedStageIndex, STAGES.indexOf(stage));
    if (clamped !== state.scrollProgress || stage.id !== state.stageId || reached !== state.reachedStageIndex) {
      setState({ scrollProgress: clamped, stageId: stage.id, reachedStageIndex: reached });
    }
  },
};

/** Subscribe a component to one primitive of the state. */
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (onChange) => store.subscribe(onChange),
    () => selector(state),
    () => selector(state)
  );
}
