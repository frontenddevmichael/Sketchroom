import { Reveal } from '../components/Reveal';
import './ComparisonTable.css';

const ROWS = [
  { feature: 'AI copilot that sketches', sketchroom: true, whiteboard: false, docs: false, standalone: false },
  { feature: 'Real-time collaboration', sketchroom: true, whiteboard: true, docs: true, standalone: false },
  { feature: 'Structured block library', sketchroom: true, whiteboard: false, docs: false, standalone: false },
  { feature: 'Version history & restore', sketchroom: true, whiteboard: false, docs: true, standalone: false },
  { feature: 'Presence & live cursors', sketchroom: true, whiteboard: true, docs: false, standalone: false },
  { feature: 'Planning-specific vocabulary', sketchroom: true, whiteboard: false, docs: false, standalone: false },
];

function Check() {
  return (
    <svg className="comp-check" viewBox="0 0 16 16" aria-label="Yes">
      <circle cx="8" cy="8" r="8" fill="var(--green-500)" />
      <path d="M4.5 8.2 L6.8 10.5 L11.5 5.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function Cross() {
  return (
    <svg className="comp-cross" viewBox="0 0 16 16" aria-label="No">
      <circle cx="8" cy="8" r="8" fill="var(--neutral-150)" />
      <path d="M5.5 5.5 l5 5M10.5 5.5 l-5 5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function ComparisonTable() {
  return (
    <section className="comp" id="comparison">
      <Reveal>
        <div className="comp-head">
          <span className="comp-eyebrow">
            <span className="comp-eyebrow-dot" aria-hidden="true" />
            Why Sketchroom
          </span>
          <h2 className="comp-title">Switch to more rewarding planning</h2>
          <p className="comp-sub">
            See how Sketchroom compares to traditional whiteboards, docs, and standalone planning tools.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="comp-table-wrap">
          <table className="comp-table">
            <thead>
              <tr>
                <th className="comp-th-feature">Feature</th>
                <th className="comp-th comp-th--highlight">Sketchroom</th>
                <th className="comp-th">Whiteboards</th>
                <th className="comp-th">Docs</th>
                <th className="comp-th">Standalone</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.feature}>
                  <td className="comp-td-feature">{r.feature}</td>
                  <td className="comp-td comp-td--highlight">{r.sketchroom ? <Check /> : <Cross />}</td>
                  <td className="comp-td">{r.whiteboard ? <Check /> : <Cross />}</td>
                  <td className="comp-td">{r.docs ? <Check /> : <Cross />}</td>
                  <td className="comp-td">{r.standalone ? <Check /> : <Cross />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </section>
  );
}
