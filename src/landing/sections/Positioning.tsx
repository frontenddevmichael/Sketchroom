import { useEffect, useRef, useState } from 'react';
import { Reveal } from '../components/Reveal';
import './Positioning.css';

/**
 * Sharp, brief problem framing. Three one-line documents (the generic tools
 * teams already have) with a hand-drawn SVG accent, then a single strong claim
 * for what Sketchroom does instead. Deliberately short on words.
 */
const GAPS = [
  {
    title: 'Whiteboards collect',
    body: 'Great for a brainstorm, frozen the moment the meeting ends. Nothing ships from a whiteboard photo.',
  },
  {
    title: 'Docs document',
    body: 'They capture the outcome — not the messy, real-time thinking that produced it.',
  },
  {
    title: 'Project tools decide',
    body: 'Great at assigning and tracking. Silent when the actual plan is still being figured out.',
  },
];

export function Positioning() {
  // The hand-drawn scribble draws itself in the first time the section
  // scrolls into view — the site's first sketch-in moment, matching the
  // product's own draw-on language.
  const scribbleRef = useRef<HTMLDivElement | null>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = scribbleRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setDrawn(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="landing-section positioning" id="product">
      <div className="positioning-grid" aria-hidden="true" ref={scribbleRef}>
        <svg className={`positioning-scribble ${drawn ? 'drawn' : ''}`} viewBox="0 0 200 40" fill="none" preserveAspectRatio="none">
          <path d="M4 24 C 40 10, 70 34, 108 22 S 168 20, 196 28" stroke="var(--neutral-400)" strokeWidth="1.4" strokeLinecap="round" />
          <path className="positioning-spark" d="M196 22 l1.4 3.8 3.8 1.4 -3.8 1.4 -1.4 3.8 -1.4 -3.8 -3.8 -1.4 3.8 -1.4 z" stroke="var(--green-500)" strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
      </div>

      <Reveal>
        <div className="landing-section-head positioning-head">
          <span className="landing-eyebrow">The gap in the middle</span>
          <h2 className="landing-section-title">
            Planning happens between the tools,
            <br className="positioning-br" />
            and that's where it usually dies.
          </h2>
        </div>
      </Reveal>

      <div className="positioning-cards">
        {GAPS.map((gap, i) => (
          <Reveal key={gap.title} delay={i * 0.08}>
            <div className="positioning-card">
              <h3 className="positioning-card-title">{gap.title}</h3>
              <p className="positioning-card-body">{gap.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <p className="positioning-claim">
          Sketchroom is the room where that thinking <span className="positioning-claim-accent">happens live</span> —
          and the copilot stays in it the whole time.
        </p>
      </Reveal>
    </section>
  );
}