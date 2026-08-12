import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { WalkthroughCanvas, type WBlock, type WCursor, type WConnector } from './WalkthroughCanvas';
import { getLenis } from '../lib/useLenis';
import './Walkthrough.css';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-driven storytelling, in the Linear/Vercel vein: a pinned viewport that
 * walks through five moments of a real planning session, mutating the same
 * canvas as you scroll. Runs React-state updates only when the active step
 * changes, keeping the pinned frame at 60fps.
 */

interface Step {
  id: string;
  num: string;
  title: string;
  body: string;
  blocks: WBlock[];
  cursors: WCursor[];
  connectors: WConnector[];
  prompt?: string;
  bubble?: string;
  topbar?: React.ReactNode;
}

const steps: Step[] = [
  {
    id: 'start',
    num: '01',
    title: 'Start with a blank room',
    body: 'Create a planning room in seconds. It is a live canvas with a back button — not a document that waits to be read.',
    blocks: [
      { id: 'w1', kind: 'rect', x: 10, y: 46, w: 22, h: 15, text: 'A blank canvas' },
    ],
    cursors: [{ id: 'wc-you', label: 'You', x: 12, y: 70, tone: 'dark' }],
    connectors: [],
    prompt: undefined,
    bubble: undefined,
  },
  {
    id: 'arrive',
    num: '02',
    title: 'Your team arrives',
    body: 'Invite links bring anyone in with one click. Cursors show up the moment they join — the room feels occupied again.',
    blocks: [
      { id: 'w1', kind: 'rect', x: 10, y: 46, w: 22, h: 15, text: 'A blank canvas' },
      { id: 'w2', kind: 'sticky', x: 42, y: 40, w: 15, h: 11, text: 'Ready when you are', rot: 1 },
    ],
    cursors: [
      { id: 'wc-you', label: 'You', x: 12, y: 70, tone: 'dark' },
      { id: 'wc-priya', label: 'Priya', x: 60, y: 26, tone: 'gray' },
      { id: 'wc-marcus', label: 'Marcus', x: 78, y: 60, tone: 'gray' },
    ],
    connectors: [],
  },
  {
    id: 'sketch',
    num: '03',
    title: 'Sketch the plan, not the bureaucracy',
    body: 'Blocks and sticky notes drop onto the canvas. The shape of the idea emerges while you talk — mess and all.',
    blocks: [
      { id: 'w-f1', kind: 'rect', x: 8, y: 24, w: 24, h: 17, text: 'Onboarding' },
      { id: 'w-f2', kind: 'rect', x: 66, y: 24, w: 26, h: 17, text: 'Activation' },
      { id: 'w-s1', kind: 'sticky', x: 30, y: 56, w: 17, h: 12, text: 'Success metric?', rot: -2 },
      { id: 'w-s2', kind: 'sticky', x: 56, y: 62, w: 15, h: 11, text: 'Needs copy', rot: 2 },
    ],
    cursors: [
      { id: 'wc-you', label: 'You', x: 14, y: 64, tone: 'dark' },
      { id: 'wc-priya', label: 'Priya', x: 70, y: 22, tone: 'gray' },
      { id: 'wc-marcus', label: 'Marcus', x: 30, y: 30, tone: 'gray' },
    ],
    connectors: [
      { id: 'wc-c1', x1: 33, y1: 32, x2: 64, y2: 32 },
    ],
  },
  {
    id: 'copilot',
    num: '04',
    title: 'The copilot drafts while you talk',
    body: 'Ask for a first pass and the copilot sketches it beside your team — as ghost blocks you can accept or throw away.',
    blocks: [
      { id: 'w-f1', kind: 'rect', x: 8, y: 24, w: 24, h: 17, text: 'Onboarding' },
      { id: 'w-f2', kind: 'rect', x: 66, y: 24, w: 26, h: 17, text: 'Activation' },
      { id: 'w-g1', kind: 'ghost', x: 8, y: 6, w: 26, h: 16, text: 'Step 1 · Copy' },
      { id: 'w-g2', kind: 'ghost', x: 66, y: 6, w: 26, h: 16, text: 'Step 2 · Nudge' },
      { id: 'w-s1', kind: 'sticky', x: 30, y: 56, w: 17, h: 12, text: 'Success metric?', rot: -2 },
    ],
    cursors: [
      { id: 'wc-you', label: 'You', x: 14, y: 64, tone: 'dark' },
      { id: 'wc-priya', label: 'Priya', x: 70, y: 22, tone: 'gray' },
      { id: 'wc-co', label: 'Copilot', x: 60, y: 52, tone: 'green' },
    ],
    connectors: [{ id: 'wc-c1', x1: 35, y1: 32, x2: 64, y2: 32 }],
    prompt: 'Sketch a 2-step onboarding for first-time teams',
    bubble: 'Accept or iterate — it is yours either way.',
  },
  {
    id: 'ship',
    num: '05',
    title: 'Refine and leave with the plan',
    body: 'Accept what works, redraft what doesn’t. One filename-less room holds the thinking — exported when you are ready.',
    blocks: [
      { id: 'w-f1', kind: 'rect', x: 8, y: 24, w: 24, h: 17, text: 'Onboarding' },
      { id: 'w-f2', kind: 'rect', x: 66, y: 24, w: 26, h: 17, text: 'Activation' },
      { id: 'w-d1', kind: 'done', x: 8, y: 6, w: 26, h: 16, text: 'Step 1 · Copy ✓' },
      { id: 'w-d2', kind: 'done', x: 66, y: 6, w: 26, h: 16, text: 'Step 2 · Nudge ✓' },
      { id: 'w-sh', kind: 'sticky', x: 42, y: 52, w: 18, h: 12, text: 'Ship it', rot: 0 },
    ],
    cursors: [
      { id: 'wc-you', label: 'You', x: 14, y: 64, tone: 'dark' },
      { id: 'wc-co', label: 'Copilot', x: 50, y: 68, tone: 'green' },
    ],
    connectors: [
      { id: 'wc-c1', x1: 35, y1: 32, x2: 64, y2: 32 },
      { id: 'wc-c2', x1: 35, y1: 14, x2: 64, y2: 14 },
    ],
    prompt: 'Looks good — let us ship this plan',
  },
];

export function Walkthrough() {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  // Pinning needs a settled viewport; stack statically on small screens.
  const isDesktop = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 901px)').matches,
    [],
  );

  const pinnedSteps = useMemo(() => (reduce ? steps.slice(0, 1) : steps), [reduce]);

  useEffect(() => {
    if (reduce || !isDesktop || !sectionRef.current) return;

    // Keep ScrollTrigger on Lenis's clock while the pin is mounted — the
    // documented integration (`lenis.on('scroll', ScrollTrigger.update)`), so
    // the smooth scroller and the pin scrub never drift apart.
    const lenis = getLenis();
    if (lenis) lenis.on('scroll', ScrollTrigger.update);

    const ctx = gsap.context(() => {
      const trigger = sectionRef.current!;
      const st = ScrollTrigger.create({
        trigger,
        start: 'top top',
        end: '+=500%',
        pin: true,
        anticipatePin: 1,
        scrub: true,
        onUpdate: (self) => {
          const next = Math.min(
            steps.length - 1,
            Math.floor(self.progress * steps.length),
          );
          setActive((prev) => (prev === next ? prev : next));
        },
      });
      return () => st.kill();
    }, sectionRef);

    return () => {
      ctx.revert();
      if (lenis) lenis.off('scroll', ScrollTrigger.update);
    };
  }, [reduce, isDesktop]);

  const step = steps[active];

  if (reduce || !isDesktop) {
    return (
      <section className="landing-section wt wt-static" id="workflow">
        <div className="landing-section-head">
          <span className="landing-eyebrow">How it works</span>
          <h2 className="landing-section-title">Five moments, one planning session</h2>
        </div>
        <div className="wt-static-list">
          {steps.map((s) => (
            <div key={s.id} className="wt-static-card">
              <span className="wt-static-num">{s.num}</span>
              <h3 className="wt-static-title">{s.title}</h3>
              <p className="wt-static-body">{s.body}</p>
              <div aria-hidden="true">
                <WalkthroughCanvas blocks={s.blocks} cursors={s.cursors} connectors={s.connectors} prompt={s.prompt} bubble={s.bubble} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="wt-wrap" id="workflow" ref={sectionRef}>
      <div className="wt-pinned">
        <AnimatePresence>
          {active === 0 && (
            <motion.div
              className="wt-scroll-hint"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              aria-hidden="true"
            >
              <span className="wt-scroll-wheel">
                <span className="wt-scroll-wheel-dot" />
              </span>
              <span className="wt-scroll-hint-text">Scroll to move through a session</span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="wt-grid">
          <div className="wt-rail" aria-hidden="true">
            {pinnedSteps.map((s, i) => (
              <span key={s.id} className={`wt-rail-item ${i === active ? 'wt-rail-active' : ''}`}>
                <motion.span
                  className="wt-rail-dot"
                  animate={{ backgroundColor: i === active ? 'var(--green-500)' : 'var(--neutral-400)' }}
                  transition={{ duration: 0.2 }}
                />
                {s.num}
              </span>
            ))}
          </div>

          <div className="wt-copy">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -16, filter: 'blur(4px)' }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="wt-num">{step.num}</span>
                <h2 className="wt-title">{step.title}</h2>
                <p className="wt-body">{step.body}</p>
              </motion.div>
            </AnimatePresence>
            <div className="wt-progress" aria-hidden="true">
              <div className="wt-progress-bar" style={{ width: `${((active + 1) / steps.length) * 100}%` }} />
            </div>
          </div>

          <div className="wt-canvas">
            <WalkthroughCanvas
              blocks={step.blocks}
              cursors={step.cursors}
              connectors={step.connectors}
              prompt={step.prompt}
              bubble={step.bubble}
            />
          </div>
        </div>
      </div>
    </section>
  );
}