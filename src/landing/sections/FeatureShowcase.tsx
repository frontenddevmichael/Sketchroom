import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Reveal } from '../components/Reveal';
import { LazyMount } from '../components/LazyMount';
import './FeatureShowcase.css';

const Walkthrough = lazy(() => import('./Walkthrough').then((m) => ({ default: m.Walkthrough })));

const AGENTS = [
  {
    id: 'copilot',
    eyebrow: 'Copilot Agent',
    title: 'Design with an agent.',
    body: 'A professional design agent, native to the canvas. It works directly on your sketch to generate and refine in place — with every change visible, editable, and under your control.',
    cta: 'Explore the copilot',
    scene: <CopilotScene />,
  },
  {
    id: 'collab',
    eyebrow: 'Collaboration Agent',
    title: 'Plan together, live.',
    body: 'See cursors, live history, and who-touched-what in real time. Remote planning feels like everyone is in the same room — no async handoffs needed.',
    cta: 'See collaboration',
    scene: <CollabScene />,
  },
  {
    id: 'blocks',
    eyebrow: 'Block Agent',
    title: 'Shape ideas with structured blocks.',
    body: 'Drop decision blocks, flow shapes, and personas in one click. The vocabulary of planning, not a blank whiteboard. Every block is data, not decoration.',
    cta: 'Browse the library',
    scene: <BlocksScene />,
  },
  {
    id: 'history',
    eyebrow: 'History Agent',
    title: 'Your thinking, always preserved.',
    body: 'Automatic snapshots, version history, and restore — your team\'s thinking is never lost. Review changes, compare states, and roll back with confidence.',
    cta: 'View version history',
    scene: <HistoryScene />,
  },
];

const ease = [0.22, 1, 0.36, 1] as const;

function AgentSection({ agent, index }: { agent: typeof AGENTS[number]; index: number }) {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); } },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`agent-section ${inView ? 'agent-section--visible' : ''}`}
      id={index === 0 ? 'features' : undefined}
    >
      <div className="agent-inner">
        <div className="agent-copy">
          <motion.span
            className="agent-eyebrow"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0, ease }}
          >
            {agent.eyebrow}
          </motion.span>

          <motion.h3
            className="agent-title"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1, ease }}
          >
            {agent.title}
          </motion.h3>

          <motion.p
            className="agent-body"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2, ease }}
          >
            {agent.body}
          </motion.p>

          <motion.a
            href="#cta"
            className="agent-cta"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3, ease }}
          >
            {agent.cta}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 7h9M7.5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.a>
        </div>

        <motion.div
          className="agent-scene"
          initial={reduce ? false : { opacity: 0, y: 40, scale: 0.97 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.15, ease }}
        >
          {agent.scene}
        </motion.div>
      </div>
    </section>
  );
}

export function FeatureShowcase() {
  return (
    <div className="agents">
      <Reveal>
        <div className="agents-header">
          <span className="agents-eyebrow">
            <span className="agents-eyebrow-dot" aria-hidden="true" />
            Inside Sketchroom
          </span>
          <h2 className="agents-title">A canvas that works like a planning session</h2>
          <p className="agents-sub">
            Four agents, each doing exactly one thing well — together they turn a blank canvas into a plan your team can act on.
          </p>
        </div>
      </Reveal>

      {AGENTS.map((agent, i) => (
        <AgentSection key={agent.id} agent={agent} index={i} />
      ))}

      {/* Walkthrough — lazy-loaded with gsap, only mounts when near viewport */}
      <LazyMount minHeight={800} className="wt-placeholder">
        <Suspense fallback={null}>
          <Walkthrough />
        </Suspense>
      </LazyMount>
    </div>
  );
}

/* ── Scene components — animated product UI ──────────────────────────── */

function CopilotScene() {
  const reduce = useReducedMotion();
  return (
    <div className="scene" aria-hidden="true">
      <div className="scene-panel">
        <div className="scene-panel-header">
          <span className="scene-panel-title">Exploration</span>
          <span className="scene-panel-count">4 variants</span>
        </div>
        <div className="scene-panel-list">
          <div className="scene-panel-item scene-panel-item--active">
            <span className="scene-panel-icon">✦</span>
            <div>
              <span className="scene-panel-name">Big Intro</span>
              <span className="scene-panel-meta">Hero + 3 feature rows</span>
            </div>
          </div>
          <div className="scene-panel-item">
            <span className="scene-panel-icon">◇</span>
            <div>
              <span className="scene-panel-name">Side Nav</span>
              <span className="scene-panel-meta">Split layout + sidebar</span>
            </div>
          </div>
          <div className="scene-panel-item">
            <span className="scene-panel-icon">□</span>
            <div>
              <span className="scene-panel-name">Card Grid</span>
              <span className="scene-panel-meta">4-card showcase</span>
            </div>
          </div>
        </div>
      </div>
      <div className="scene-canvas">
        <motion.div
          className="scene-block scene-block--primary"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          Hero·v2
        </motion.div>
        <motion.div
          className="scene-block scene-block--ghost"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          Hero·v3
        </motion.div>
        <svg className="scene-spark" viewBox="0 0 12 12" style={{ left: '48%', top: '25%' }}>
          <path d="M6 0 l1.4 4.6 4.6 1.4 -4.6 1.4 -1.4 4.6 -1.4 -4.6 -4.6 -1.4 4.6 -1.4 z" />
        </svg>
        <motion.div
          className="scene-cursor scene-cursor--green"
          style={{ left: '60%', top: '20%' }}
          animate={reduce ? {} : { x: [0, -12, 5, 0], y: [0, 8, -4, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="scene-bubble"
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 1 }}
        >
          <span className="scene-typing">
            <span /><span /><span />
          </span>
          try a 2-step fallback
        </motion.div>
      </div>
    </div>
  );
}

function CollabScene() {
  const reduce = useReducedMotion();
  return (
    <div className="scene" aria-hidden="true">
      <div className="scene-canvas">
        <motion.div
          className="scene-cursor"
          style={{ left: '18%', top: '28%' }}
          animate={reduce ? {} : { x: [0, 30, 15, 40, 0], y: [0, -10, 20, 5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="scene-cursor"
          style={{ left: '68%', top: '52%' }}
          animate={reduce ? {} : { x: [0, -20, -5, -25, 0], y: [0, 15, -8, 10, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="scene-cursor scene-cursor--green"
          style={{ left: '40%', top: '70%' }}
          animate={reduce ? {} : { x: [0, 10, -8, 5, 0], y: [0, -20, -5, -15, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="scene-block"
          style={{ left: '12%', top: '48%' }}
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Auth·v2
        </motion.div>
        <motion.div
          className="scene-block"
          style={{ left: '52%', top: '22%' }}
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          API·v1
        </motion.div>
        <motion.div
          className="scene-label"
          style={{ left: '20%', top: '16%' }}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.8 }}
        >
          Maya
        </motion.div>
        <motion.div
          className="scene-label scene-label--green"
          style={{ left: '58%', top: '64%' }}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.1 }}
        >
          Alex
        </motion.div>
      </div>
    </div>
  );
}

function BlocksScene() {
  const reduce = useReducedMotion();
  return (
    <div className="scene" aria-hidden="true">
      <div className="scene-canvas">
        <div className="scene-toolbar">
          <span className="scene-tool scene-tool--active">✦</span>
          <span className="scene-tool">□</span>
          <span className="scene-tool">◇</span>
          <span className="scene-tool">✎</span>
        </div>
        <motion.div
          className="scene-block scene-block--ghost scene-block--drop"
          initial={reduce ? false : { opacity: 0, y: -40, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4, type: 'spring', stiffness: 200, damping: 18 }}
        >
          Decision
        </motion.div>
        <motion.div
          className="scene-block"
          style={{ left: '25%', top: '55%' }}
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          Auth·v2
        </motion.div>
        <motion.div
          className="scene-block"
          style={{ left: '55%', top: '30%' }}
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          API·v1
        </motion.div>
      </div>
    </div>
  );
}

function HistoryScene() {
  const reduce = useReducedMotion();
  return (
    <div className="scene" aria-hidden="true">
      <div className="scene-canvas">
        <div className="scene-history">
          <span className="scene-history-chip">2m ago</span>
          <span className="scene-history-chip">1m ago</span>
          <motion.span
            className="scene-history-chip scene-history-chip--now"
            animate={reduce ? {} : { boxShadow: ['0 0 0 0 oklch(0.78 0.19 148 / 0)', '0 0 0 6px oklch(0.78 0.19 148 / 0.25)', '0 0 0 0 oklch(0.78 0.19 148 / 0)'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          >
            now
          </motion.span>
        </div>
        <motion.div
          className="scene-cursor"
          style={{ left: '22%', top: '32%' }}
          animate={reduce ? {} : { x: [0, 20, 10, 25, 0], y: [0, 10, -5, 15, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="scene-cursor scene-cursor--green"
          style={{ left: '62%', top: '58%' }}
          animate={reduce ? {} : { x: [0, -15, 5, -10, 0], y: [0, -10, 10, -5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="scene-block"
          style={{ left: '28%', top: '48%' }}
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          Sprint·plan
        </motion.div>
      </div>
    </div>
  );
}
