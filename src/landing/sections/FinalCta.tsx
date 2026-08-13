import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '../components/Reveal';
import './FinalCta.css';

const TITLE_LINES = [
  ['Your', 'next', 'plan', 'deserves'],
  ['a', 'room.'],
];

function Spark({ className = '' }: { className?: string }) {
  return (
    <svg className={`cta-spark ${className}`} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 0 l1.4 4.6 4.6 1.4 -4.6 1.4 -1.4 4.6 -1.4 -4.6 -4.6 -1.4 4.6 -1.4 z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="cta-check" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.5 7.2 L5.6 10.3 L11.5 3.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function FinalCta() {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="final-cta" id="cta">
      {/* Background layer: canvas texture + two ghost "room" fragments,
          drifting slowly, tying this section back to FeatureShowcase's
          scenes — the product itself is what's closing the sale. */}
      <div className="final-cta-canvas" aria-hidden="true">
        <div className="cta-room cta-room-a">
          <span className="cta-block">Launch·v1</span>
          <span className="cta-block cta-block-ghost">Launch·v2</span>
          <span className="cta-cursor cta-cursor-green" />
        </div>
        <div className="cta-room cta-room-b">
          <span className="cta-bubble">shipped 🎉</span>
          <span className="cta-cursor" />
        </div>
      </div>

      <Reveal>
        <div ref={innerRef} className={`final-cta-inner ${inView ? 'in-view' : ''}`}>
          <span className="landing-eyebrow">
            <span className="landing-eyebrow-dot" aria-hidden="true" />
            Ready when you are
          </span>

          <h2 className="final-cta-title" aria-label="Your next plan deserves a room.">
            {TITLE_LINES.map((line, li) => (
              <span className="cta-title-line" key={li} aria-hidden="true">
                {line.map((word, wi) => (
                  <span
                    className="cta-word"
                    key={word}
                    style={{ '--i': li * 4 + wi } as React.CSSProperties}
                  >
                    {word}
                  </span>
                ))}
                {li === 0 ? <br /> : null}
              </span>
            ))}
            <Spark className="cta-spark-title cta-spark-title-1" />
            <Spark className="cta-spark-title cta-spark-title-2" />
          </h2>

          <div className="final-cta-actions">
            <span className="cta-bracket-wrap">
              <svg className="cta-bracket" viewBox="0 0 220 74" preserveAspectRatio="none" aria-hidden="true">
                <path d="M10 8 C 4 8, 4 8, 4 16 L4 58 C 4 66, 4 66, 10 66 M210 8 C 216 8, 216 8, 216 16 L216 58 C 216 66, 216 66, 210 66" />
              </svg>
              <Link to="/auth" className="btn btn-primary final-cta-primary">
                Start sketching
              </Link>
            </span>
            <a href="#top" className="btn btn-secondary">
              Back to the room
            </a>
          </div>

          <ul className="final-cta-features">
            <li><CheckIcon />Free to start</li>
            <li><CheckIcon />No credit card</li>
            <li><CheckIcon />Your first room in 30 seconds</li>
          </ul>
        </div>
      </Reveal>

      <svg className="final-cta-seam" viewBox="0 0 1200 24" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 12 C 150 2, 300 22, 450 12 S 750 2, 900 12 S 1100 20, 1200 10" />
      </svg>
    </section>
  );
}