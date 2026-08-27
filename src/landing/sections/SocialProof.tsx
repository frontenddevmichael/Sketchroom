import { Reveal } from '../components/Reveal';
import './SocialProof.css';

const AVATARS = [
  { initials: 'MC', color: 'oklch(0.65 0.15 150)' },
  { initials: 'AR', color: 'oklch(0.6 0.12 250)' },
  { initials: 'JP', color: 'oklch(0.7 0.1 30)' },
  { initials: 'ST', color: 'oklch(0.55 0.14 280)' },
  { initials: 'PN', color: 'oklch(0.65 0.12 180)' },
  { initials: 'KL', color: 'oklch(0.6 0.1 340)' },
];

const TRUST_SIGNALS = [
  { value: '< 2s', label: 'AI response time' },
  { value: '99.97%', label: 'Uptime SLA' },
  { value: 'E2E', label: 'Encryption' },
  { value: 'SOC 2', label: 'In progress' },
];

export function SocialProof() {
  return (
    <section className="social" id="trust">
      <Reveal>
        <div className="social-header">
          <span className="social-eyebrow">
            <span className="social-eyebrow-dot" aria-hidden="true" />
            Trusted by teams
          </span>
          <h2 className="social-title">Built for real teams</h2>
          <p className="social-sub">
            Presence is the proof. See who&rsquo;s working, what&rsquo;s happening, and why it matters.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="social-presence">
          <div className="social-avatar-stack">
            {AVATARS.map((a, i) => (
              <span
                key={a.initials}
                className="social-avatar-bubble"
                style={{ background: a.color, zIndex: AVATARS.length - i }}
              >
                {a.initials}
              </span>
            ))}
            <span className="social-avatar-more">+24</span>
          </div>
          <p className="social-presence-text">
            <strong>29 people</strong> are sketching right now
          </p>
        </div>
      </Reveal>

      <div className="social-trust-grid">
        {TRUST_SIGNALS.map((s, i) => (
          <Reveal key={s.label} delay={0.15 + i * 0.05}>
            <div className="social-trust-card">
              <span className="social-trust-value">{s.value}</span>
              <span className="social-trust-label">{s.label}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
