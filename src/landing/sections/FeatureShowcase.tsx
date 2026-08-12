import { Reveal } from '../components/Reveal';
import './FeatureShowcase.css';

/**
 * Three feature moments, each a tiny self-contained animation of the real
 * canvas (no tldraw) so the page stays light: copilot iteration, block-library
 * insert, and presence + live history.
 */

function CopilotScene() {
  return (
    <div className="fs-scene" aria-hidden="true">
      <div className="fs-block fs-block-a">Flow·v1</div>
      <div className="fs-block fs-block-b fs-ghost">Flow·v2</div>
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
    title: 'The copilot drafts, not just annotates',
    body: 'Tell it what to sketch and it lays out the first pass — blocks, flow, and labels — while your team keeps working.',
    scene: <CopilotScene />,
  },
  {
    eyebrow: 'Blocks',
    title: 'Shape ideas with a block library',
    body: 'Drop decision blocks, sticky notes, and flow shapes in one click. The vocabulary of planning, not a blank whiteboard.',
    scene: <LibraryScene />,
  },
  {
    eyebrow: 'Presence',
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
            <article className="fs-card">
              <div className="fs-scene-wrap">{f.scene}</div>
              <div className="fs-card-body">
                <span className="fs-eyebrow">{f.eyebrow}</span>
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