import { Reveal } from '../components/Reveal';
import './Trust.css';

/**
 * Honest trust section: no fabricated logos or testimonials. Instead it shows
 * presence *as* the product proof — the same avatars from the hero — and leaves
 * an explicit space where real team marks will slot in later.
 */

// The same people who appear in the walkthrough session — the page's cast is
// one coherent team, so "planning right now" reads as specific, not generic.
const PRESENT = [
  { initial: 'P', name: 'Priya', tone: 'a2' },
  { initial: 'M', name: 'Marcus', tone: 'a3' },
  { initial: 'A', name: 'Ada', tone: 'a4' },
];

function AvatarStack() {
  return (
    <div className="trust-avatars" aria-hidden="true">
      <span className="trust-avatar t-a1 trust-avatar-copilot" title="Copilot">
        ✦
      </span>
      {PRESENT.map((p) => (
        <span key={p.initial} className={`trust-avatar ${p.tone}`} title={p.name}>
          {p.initial}
        </span>
      ))}
      <span className="trust-avatar t-a5 trust-avatar-empty">+</span>
    </div>
  );
}

export function Trust() {
  return (
    <section className="landing-section trust" id="trust">
      <Reveal>
        <div className="trust-inner">
          <AvatarStack />
          <h2 className="landing-section-title trust-title">
            People are planning in it right now
          </h2>
          <p className="landing-section-sub trust-sub">
            Live collaboration is the proof — not a logo wall. The empty seat is
            reserved for your team's mark.
          </p>
          <div className="trust-slots" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="trust-slot">
                Your team mark
              </span>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}