import { Reveal } from '../components/Reveal';
import './PerformanceSection.css';

const VITALS = [
  { label: 'LCP', value: '1.1s', description: 'Largest Contentful Paint', target: '<2.5s' },
  { label: 'INP', value: '95ms', description: 'Interaction to Next Paint', target: '<200ms' },
  { label: 'CLS', value: '0.01', description: 'Cumulative Layout Shift', target: '<0.1' },
  { label: 'FCP', value: '0.8s', description: 'First Contentful Paint', target: '<1.8s' },
];

const STATS = [
  { label: 'Rooms created', value: '12,400+', trend: '+23% this month' },
  { label: 'AI suggestions', value: '48,200+', trend: '92% accepted' },
  { label: 'Collaboration hours', value: '8,600+', trend: '2.4x faster planning' },
  { label: 'Uptime', value: '99.97%', trend: 'Last 90 days' },
];

function VitalBar({ label, value, description, target }: typeof VITALS[number]) {
  const numVal = parseFloat(value);
  const numTarget = parseFloat(target.replace(/[<>]/g, ''));
  const pct = Math.min(
    (label === 'FCP' ? numVal / numTarget : numTarget / numVal) * 60,
    95
  );

  return (
    <div className="vital">
      <div className="vital-header">
        <span className="vital-label">{label}</span>
        <span className="vital-desc">{description}</span>
      </div>
      <div className="vital-value-row">
        <span className="vital-value">{value}</span>
        <span className="vital-target">Target: {target}</span>
      </div>
      <div className="vital-track">
        <div className="vital-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function PerformanceSection() {
  return (
    <section className="perf" id="performance">
      <Reveal>
        <div className="perf-header">
          <span className="perf-eyebrow">
            <span className="perf-eyebrow-dot" aria-hidden="true" />
            Performance
          </span>
          <h2 className="perf-title">Crafted for speed, built for trust</h2>
          <p className="perf-sub">
            Every interaction is optimized. Sketchroom ships real Web Vitals, not marketing promises.
          </p>
        </div>
      </Reveal>

      {/* Web Vitals — Framer-style metrics strip */}
      <Reveal delay={0.1}>
        <div className="perf-vitals">
          <div className="perf-vitals-header">
            <span className="perf-vitals-badge">
              <span className="perf-vitals-dot" />
              Core Web Vitals — passing
            </span>
          </div>
          <div className="perf-vitals-grid">
            {VITALS.map((v) => (
              <VitalBar key={v.label} {...v} />
            ))}
          </div>
        </div>
      </Reveal>

      {/* Stats grid */}
      <Reveal delay={0.15}>
        <div className="perf-stats">
          {STATS.map((m) => (
            <article key={m.label} className="perf-stat">
              <span className="perf-stat-value">{m.value}</span>
              <span className="perf-stat-label">{m.label}</span>
              <span className="perf-stat-trend">{m.trend}</span>
            </article>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
