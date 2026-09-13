// The DOM text beats of the climb, ported from V1 (src/ui/Hero.jsx, Sections.jsx, Contact.jsx).
// Identity and contact facts come from the profile data through props (one availability
// statement site-wide, D-18); the rest is the owner's copy as shipped (data/copy.ts).
import RevealText from './RevealText';
import { statement, philosophy, footholds, areasOfFocus, spark, closingPrinciple, contactIntro } from '../data/copy';

export function Hero({ name, roleLine }: { name: string; roleLine: string }) {
  return (
    <section className="climb-section" data-beat="arrival">
      <div className="inner">
        <p className="kicker">Khaylub.com</p>
        {/* An h2: the V2 page owns the h1 (one h1 per page). Focus lands here when the island opens. */}
        <h2 className="h1" tabIndex={-1} data-climb-focus>
          {name}
        </h2>
        <p className="role">{roleLine}</p>
        <p className="statement">{statement}</p>
      </div>
    </section>
  );
}

export function Philosophy() {
  return (
    <section className="climb-section" data-beat="philosophy">
      <div className="inner inner--reveal">
        <RevealText className="lead" stageId="philosophy" text={philosophy.lead} from={0} to={0.28} />
        <RevealText className="body" stageId="philosophy" text={philosophy.body} from={0.12} to={0.42} />
      </div>
    </section>
  );
}

export function Footholds() {
  return (
    <section className="climb-section" data-beat="focus">
      <div className="inner">
        <p className="kicker">{footholds.kicker}</p>
        <p className="lead lead--connector">{footholds.lede}</p>
        <ul className="focus-list">
          {areasOfFocus.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Spark() {
  return (
    <section className="climb-section" data-beat="spark">
      <div className="inner inner--reveal">
        <p className="kicker">{spark.kicker}</p>
        <RevealText className="lead" stageId="spark" text={spark.line} from={0} to={0.4} intensity={1.3} warm />
      </div>
    </section>
  );
}

export type ContactLink = { label: string; href: string };

export function Contact({ availability, links }: { availability: string; links: ContactLink[] }) {
  return (
    <section className="climb-section" data-beat="contact">
      <div className="inner inner--reveal">
        <RevealText className="lead" stageId="contact" text={closingPrinciple} from={0} to={0.5} intensity={1.6} warm />
        <p className="body">{contactIntro}</p>
        <p className="availability">{availability}</p>
        <div className="contact-links">
          {links.map((l) => (
            <a key={l.label} href={l.href} rel={l.href.startsWith('http') ? 'noopener noreferrer' : undefined}>
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
