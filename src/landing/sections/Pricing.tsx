import { Link } from 'react-router-dom';
import { Reveal } from '../components/Reveal';
import './Pricing.css';

const FREE_FEATURES = [
  'Up to 3 rooms',
  'Up to 3 collaborators per room',
  '40 AI suggestions per month',
  'Unlimited sketching',
];

const TEAM_FEATURES = [
  'Unlimited rooms',
  'Unlimited collaborators',
  'Unlimited AI suggestions',
  'Version history',
  'PNG / PDF export',
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
            <span className="pricing-badge">For working teams</span>
            <h3 className="pricing-card-name">Team</h3>
            <p className="pricing-price">
              $8<span className="pricing-period">/seat/mo</span>
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
            <Link to="/auth" className="btn btn-primary pricing-cta">
              Start Team
            </Link>
            <p className="pricing-note">Cancel anytime · No surprise charges</p>
          </article>
        </Reveal>
      </div>

      <Reveal delay={0.1}>
        <p className="pricing-footnote">
          Rooms run free forever on the free plan. Billing lives in the app, after you've sketched enough to want it.
        </p>
      </Reveal>
    </section>
  );
}