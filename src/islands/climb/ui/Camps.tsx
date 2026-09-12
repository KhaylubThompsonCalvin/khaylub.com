// The Camps beat, ported from V1 (src/ui/ProjectCards.jsx) under ADR-011 decision 4: the five
// worlds stay as narrative, and a card is a link to its V2 project page instead of a dialog. The
// three concept worlds have no page yet, so they are plain cards with V1's own honest note (never
// a dead anchor). The concept films and posters V1 played on these cards have no recorded
// provenance yet and are not shipped; the frame is a plain film-dark panel until the owner records
// them. Cards rise in on scroll through one shared IntersectionObserver; reduced motion shows them.
import { useEffect, useRef, type CSSProperties } from 'react';
import { camps, campWorlds } from '../data/copy';

function statusState(status: string): 'live' | 'progress' | 'concept' {
  const s = status.toLowerCase();
  if (s.startsWith('live')) return 'live';
  if (s.includes('beta') || s.includes('progress')) return 'progress';
  return 'concept';
}

export default function Camps() {
  const list = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const cards = list.current?.querySelectorAll<HTMLElement>('.camp');
    if (!cards?.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) entry.target.classList.toggle('is-in', entry.isIntersecting);
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' }
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <section className="climb-section" data-beat="camps">
      <div className="inner">
        <div className="work-intro">
          <p className="kicker">{camps.kicker}</p>
          <p className="work-lede">{camps.lede}</p>
        </div>
        <ul className="camps" ref={list}>
          {campWorlds.map((c, i) => {
            const state = statusState(c.status);
            const body = (
              <>
                <span className="camp-title">{c.name}</span>
                <span className="camp-concept">{c.concept}</span>
                <span className={`status status--${state}`}>
                  <span className="dot" aria-hidden="true" />
                  {c.status}
                </span>
                {c.href ? <span className="camp-cue">View the project</span> : <span className="camp-note">Concept. In design, not yet built.</span>}
              </>
            );
            return (
              <li key={c.id} style={{ '--card-i': i } as CSSProperties}>
                {c.href ? (
                  <a className="camp camp--link" href={c.href}>
                    {body}
                  </a>
                ) : (
                  <div className="camp camp--concept">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
