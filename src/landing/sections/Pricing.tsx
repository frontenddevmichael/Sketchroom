import { Link } from 'react-router-dom';
import { Reveal } from '../components/Reveal';
import './Pricing.css';

const FREE_FEATURES = [
  'Up to 3 rooms',
  'Up to 3 collaborators per room',
  '40 AI suggestions per month',
  'Unlimited sketching',
  'Version history',
  'PNG / PDF / SVG export',
];

const TEAM_FEATURES = [
  'Unlimited rooms',
  'Unlimited collaborators',
  'Unlimited AI suggestions',
  'Priority support',
];

export function Pricing() {
  return (
    <section className="landing-section pricing" id="pricing">
      <Reveal>
        <div className="landing-section-head">
          <span className="landing-eyebrow">Pricing</span>
          <h2 className="landing-section-title">Start free. Scale when the room grows.</h2>
          <p className="landing-section-sub">
            No feature-gated sketching. The free plan is a real room, not a trial.
          </p>
        </div>
      </Reveal>

      <div className="pricing-grid">
        <Reveal delay={0.05}>
          <article className="pricing-card">
            <h3 className="pricing-card-name">Free</h3>
            <p className="pricing-price">
              $0<span className="pricing-period">/mo</span>
            </p>
            <p className="pricing-desc">For trying the room with a few teammates.</p>
            <ul className="pricing-list">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="pricing-item">
                  <span className="pricing-check" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6.2 5 9l5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link to="/auth" className="btn btn-primary pricing-cta">
              Start free
            </Link>
            <p className="pricing-note">Free forever · No card required</p>
          </article>
        </Reveal>

        <Reveal delay={0.12}>
          <article className="pricing-card pricing-card-featured">
            <span className="pricing-badge">Coming soon</span>
            <h3 className="pricing-card-name">Team</h3>
            <p className="pricing-price">
              Unlimited<span className="pricing-period">when it ships</span>
            </p>
            <p className="pricing-desc">Unlimited rooms and the copilot without limit.</p>
            <ul className="pricing-list">
              {TEAM_FEATURES.map((f) => (
                <li key={f} className="pricing-item">
                  <span className="pricing-check" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6.2 5 9l5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <p className="pricing-note">
              The Team plan is on its way. Until it ships, version history and export are free for everyone.
            </p>
          </article>
        </Reveal>
      </div>

      <Reveal delay={0.1}>
        <p className="pricing-footnote">
          Rooms run free forever on the free plan, and nothing is locked behind a paywall yet. When Team ships, billing lives in the app.
        </p>
      </Reveal>
    </section>
  );
}