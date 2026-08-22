import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '../components/Reveal';
import './FinalCta.css';

const SUGGESTIONS = [
  'Create a personal portfolio',
  'Build a startup landing page',
  'Design a SaaS dashboard',
  'Sketch a mobile app flow',
  'Plan a product roadmap',
];

export function FinalCta() {
  const [input, setInput] = useState('');

  return (
    <section className="final-cta" id="cta">
      <Reveal>
        <div className="final-cta-inner">
          <span className="final-cta-eyebrow">
            <span className="final-cta-eyebrow-dot" aria-hidden="true" />
            Get started in 30 seconds
          </span>

          <h2 className="final-cta-title">
            What will you sketch first?
          </h2>

          <p className="final-cta-lead">
            Join thousands of teams who use Sketchroom to plan, sketch, and ship faster.
            Free to start. No credit card.
          </p>

          {/* Prompt input — Framer-style */}
          <div className="final-cta-input-wrap">
            <div className="final-cta-input">
              <svg className="final-cta-input-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M9 1.5l2.1 6.5h6.8l-5.5 4 2.1 6.5L9 14.5 3.5 18.5l2.1-6.5L0.1 8h6.8z" fill="currentColor" opacity="0.15" />
                <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
              <input
                type="text"
                className="final-cta-field"
                placeholder="Describe what you want to build…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                aria-label="Describe what you want to build"
              />
              <Link
                to="/auth"
                className="final-cta-send"
                aria-label="Start building"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Suggestion chips */}
          <div className="final-cta-chips">
            {SUGGESTIONS.map((s) => (
              <Link
                key={s}
                to="/auth"
                className="final-cta-chip"
                onClick={() => setInput(s)}
              >
                {s}
              </Link>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
