// Phase 9 stub of the climb island. It renders a clearly labeled placeholder with the skip
// control the real island will keep. No models, video, or three.js are imported here.
type Props = { onSkip: () => void };

export function ClimbIsland({ onSkip }: Props) {
  return (
    <section
      aria-label="The climb"
      style={{
        marginTop: '1rem',
        padding: '1.5rem',
        border: '2px dashed var(--muted)',
        borderRadius: '10px',
        background: 'var(--card)',
      }}
    >
      <h2 style={{ marginTop: 0 }} tabIndex={-1} data-climb-focus>
        The climb (island placeholder)
      </h2>
      <p>
        This is the mount point for the original 3D experience. The scene, its models, and its
        video plates are ported into this island at a later phase. Nothing from them loaded before
        you pressed the door.
      </p>
      <button type="button" className="btn" onClick={onSkip}>
        Skip the climb
      </button>
    </section>
  );
}
