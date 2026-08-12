import { Link } from 'react-router-dom';
import { Reveal } from '../components/Reveal';
import './FinalCta.css';

export function FinalCta() {
  return (
    <section className="final-cta">
      <Reveal>
        <div className="final-cta-inner">
          <span className="landing-eyebrow">
            <span className="landing-eyebrow-dot" aria-hidden="true" />
            Ready when you are
          </span>
          <h2 className="final-cta-title">
            Your next plan deserves
            <br />
            a room.
            <span className="final-cta-sparkle" aria-hidden="true">✦</span>
          </h2>
          <div className="final-cta-actions">
            <Link to="/auth" className="btn btn-primary final-cta-primary">
              Start sketching — free
            </Link>
            <a href="#top" className="btn btn-secondary">
              Back to the room
            </a>
          </div>
          <p className="final-cta-note">
            Free to start · No credit card · Your first room in 30 seconds
          </p>
        </div>
      </Reveal>
    </section>
  );
}