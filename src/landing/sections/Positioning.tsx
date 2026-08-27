import { useEffect, useRef, useState } from 'react';
import { Reveal } from '../components/Reveal';
import './Positioning.css';

const GAPS = [
  {
    title: 'Whiteboards collect',
    body: 'Great for a brainstorm, frozen the moment the meeting ends. Nothing ships from a whiteboard photo.',
    // frozen frame / flash-corner mark
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="4" y="5" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M4 14.5 L9 10 L12.5 13 L16 9 L20 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 4 l0.8 2 2 0.8 -2 0.8 -0.8 2 -0.8 -2 -2 -0.8 2 -0.8 z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Docs document',
    body: 'They capture the outcome — not the messy, real-time thinking that produced it.',
    // page with folded corner
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M6 4h9l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M15 4v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M8 13h8M8 16.5h5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Project tools decide',
    body: 'Great at assigning and tracking. Silent when the actual plan is still being figured out.',
    // checklist, mid-item trailing off
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="4.5" y="5.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 7.5l1 1 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 7.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <rect x="4.5" y="13" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.4" strokeDasharray="1.5 1.7" />
        <path d="M11 15h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="0.5 3.2" />
      </svg>
    ),
  },
];

// Small, fixed "hand-placed" tilts — not random per render, just imperfect.
const TILTS = [-1.6, 1.1, -1];

export function Positioning() {
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
            <div
              className="positioning-card"
              style={{ '--tilt': `${TILTS[i]}deg` } as React.CSSProperties}
            >
              <span className="positioning-card-icon" aria-hidden="true">
                {gap.icon}
              </span>
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

      <Reveal delay={0.32}>
        <div className="positioning-copilot-chip" aria-hidden="true">
          <span className="positioning-copilot-dot" />
          copilot, still here
        </div>
      </Reveal>
    </section>
  );
}