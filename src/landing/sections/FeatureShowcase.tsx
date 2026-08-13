import { Reveal } from '../components/Reveal';
import './FeatureShowcase.css';

function CopilotScene() {
  return (
    <div className="fs-scene" aria-hidden="true">
      <div className="fs-block fs-block-a">Flow·v1</div>
      <div className="fs-block fs-block-b fs-ghost">Flow·v2</div>
      <svg className="fs-spark" viewBox="0 0 12 12" style={{ left: '48%', top: '30%' }}>
        <path d="M6 0 l1.4 4.6 4.6 1.4 -4.6 1.4 -1.4 4.6 -1.4 -4.6 -4.6 -1.4 4.6 -1.4 z" />
      </svg>
      <div className="fs-cursor fs-cursor-green" style={{ left: '55%', top: '18%' }} />
      <div className="fs-bubble fs-bubble-top">try a 2-step fallback</div>
    </div>
  );
}

function LibraryScene() {
  return (
    <div className="fs-scene" aria-hidden="true">
      <div className="fs-toolbar">
        <span className="fs-tool fs-tool-active">✦</span>
        <span className="fs-tool">□</span>
        <span className="fs-tool">◇</span>
        <span className="fs-tool">✎</span>
      </div>
      <div className="fs-block fs-block-b fs-ghost fs-ghost-drop">Decision</div>
      <svg className="fs-spark fs-spark-drop" viewBox="0 0 12 12" style={{ right: '14%', top: '30%' }}>
        <path d="M6 0 l1.4 4.6 4.6 1.4 -4.6 1.4 -1.4 4.6 -1.4 -4.6 -4.6 -1.4 4.6 -1.4 z" />
      </svg>
    </div>
  );
}

function PresenceScene() {
  return (
    <div className="fs-scene" aria-hidden="true">
      <div className="fs-cursor" style={{ left: '20%', top: '30%' }} />
      <div className="fs-cursor" style={{ left: '70%', top: '55%' }} />
      <div className="fs-cursor fs-cursor-green" style={{ left: '42%', top: '72%' }} />
      <div className="fs-history">
        <span className="fs-history-chip is-past">2m ago</span>
        <span className="fs-history-chip is-past">1m ago</span>
        <span className="fs-history-chip is-now">now</span>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    eyebrow: 'Copilot',
    aiRelated: true,
    title: 'The copilot drafts, not just annotates',
    body: 'Tell it what to sketch and it lays out the first pass — blocks, flow, and labels — while your team keeps working.',
    scene: <CopilotScene />,
  },
  {
    eyebrow: 'Blocks',
    aiRelated: false,
    title: 'Shape ideas with a block library',
    body: 'Drop decision blocks, sticky notes, and flow shapes in one click. The vocabulary of planning, not a blank whiteboard.',
    scene: <LibraryScene />,
  },
  {
    eyebrow: 'Presence',
    aiRelated: false,
    title: 'See the room thinking, live',
    body: 'Cursors, live history, and who-touched-what — so remote planning feels like everyone is in the same room.',
    scene: <PresenceScene />,
  },
];

export function FeatureShowcase() {
  return (
    <section className="landing-section fs" id="features">
      <Reveal>
        <div className="landing-section-head">
          <span className="landing-eyebrow">Inside the room</span>
          <h2 className="landing-section-title">A canvas that works like a planning session</h2>
          <p className="landing-section-sub">
            Three moments from a real Sketchroom session — each one does exactly one thing, well.
          </p>
        </div>
      </Reveal>

      <div className="fs-grid">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.08}>
            <article className="fs-card" style={{ '--fs-delay': `${i * 0.08}s` } as React.CSSProperties}>
              <div className="fs-scene-wrap">
                {f.scene}
                <svg className="fs-divider" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 6 C 60 -1, 110 13, 170 5 S 250 1, 300 7" />
                </svg>
              </div>
              <div className="fs-card-body">
                <span className="fs-eyebrow">
                  <span className={`fs-eyebrow-dot${f.aiRelated ? ' fs-eyebrow-dot--ai' : ''}`} />
                  {f.eyebrow}
                </span>
                <h3 className="fs-title">{f.title}</h3>
                <p className="fs-body">{f.body}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}