import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Reveal } from '../components/Reveal';
import './SocialProof.css';

const TESTIMONIALS = [
  {
    quote: 'Sketchroom replaced three tools for us — whiteboard, doc, and async standup. One canvas, one conversation.',
    name: 'Maya Chen',
    role: 'Head of Product, Flux Labs',
    avatar: 'MC',
  },
  {
    quote: 'The AI copilot is the first one that actually understands architecture. It sketches real diagrams, not just boxes and arrows.',
    name: 'Alex Rivera',
    role: 'Staff Engineer, Nimbus',
    avatar: 'AR',
  },
  {
    quote: 'Our remote team went from 45-minute planning calls to 15-minute sketch sessions. The canvas does the talking.',
    name: 'Jordan Park',
    role: 'Engineering Manager, Helix',
    avatar: 'JP',
  },
  {
    quote: 'I sketch the idea, the copilot drafts it, and my team refines it live. That loop replaced our entire design sprint.',
    name: 'Sam Torres',
    role: 'Founder, Vantage',
    avatar: 'ST',
  },
  {
    quote: 'Version history alone is worth it. We can always roll back to the good version of the plan.',
    name: 'Priya Nair',
    role: 'Tech Lead, Pulse AI',
    avatar: 'PN',
  },
];

const COMPANIES = ['Flux Labs', 'Nimbus', 'Helix', 'Vantage', 'Pulse AI', 'Orbit'];

const ease = [0.22, 1, 0.36, 1] as const;

function TestimonialCard({ t, index }: { t: typeof TESTIMONIALS[number]; index: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      className="social-card"
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08, ease }}
    >
      <p className="social-quote">&ldquo;{t.quote}&rdquo;</p>
      <div className="social-author">
        <span className="social-avatar" aria-hidden="true">{t.avatar}</span>
        <div className="social-author-info">
          <span className="social-name">{t.name}</span>
          <span className="social-role">{t.role}</span>
        </div>
      </div>
    </motion.div>
  );
}

export function SocialProof() {
  return (
    <section className="social" id="trust">
      <Reveal>
        <div className="social-header">
          <span className="social-eyebrow">
            <span className="social-eyebrow-dot" aria-hidden="true" />
            Trusted by teams
          </span>
          <h2 className="social-title">Teams that sketch it first</h2>
          <p className="social-sub">
            From startups to enterprises, teams use Sketchroom to plan, sketch, and ship faster.
          </p>
        </div>
      </Reveal>

      <div className="social-grid">
        {TESTIMONIALS.map((t, i) => (
          <TestimonialCard key={t.name} t={t} index={i} />
        ))}
      </div>

      <Reveal delay={0.15}>
        <div className="social-logos">
          <span className="social-logos-label">Trusted by teams at</span>
          <div className="social-logos-row">
            {COMPANIES.map((c) => (
              <span key={c} className="social-logo">{c}</span>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
