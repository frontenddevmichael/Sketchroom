import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { DemoCanvas } from '../demo/DemoCanvas';
import './Hero.css';

const copyEase = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const reduce = useReducedMotion();

  const stagger = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay: 0.08 * i, ease: copyEase },
  });

  return (
    <section className="hero" id="top">
      <div className="hero-bg-rings" aria-hidden="true">
        <motion.span
          className="hero-ring hero-ring-1"
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.2, ease: copyEase }}
        />
        <motion.span
          className="hero-ring hero-ring-2"
          initial={reduce ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.3, delay: 0.35, ease: copyEase }}
        />
      </div>

      <div className="hero-content">
        <div className="hero-copy">
          <motion.div {...stagger(0)}>
            <span className="landing-eyebrow">
              <span className="landing-eyebrow-dot" aria-hidden="true" />
              Real-time planning canvas
            </span>
          </motion.div>

          <motion.h1 {...stagger(1)} className="landing-display hero-title">
            <span className="hero-title-line">Plan it together, live.</span>
            <span className="hero-title-line hero-title-line-muted">An AI copilot</span>
            <span className="hero-title-line hero-title-accent">
              in the room.
              <svg className="hero-underline" viewBox="0 0 200 12" fill="none" preserveAspectRatio="none" aria-hidden="true">
                <motion.path
                  d="M4 8 C 40 3, 90 10, 196 6"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.7, delay: 0.85, ease: 'easeInOut' }}
                />
              </svg>
            </span>
          </motion.h1>

          <motion.div {...stagger(2)}>
            <p className="landing-lead hero-lead">
              Sketch architecture, wireframes, and features with your team — while the
              copilot drafts alongside you. Same canvas, same page, in real time.
            </p>
          </motion.div>

          <motion.div {...stagger(3)} className="hero-cta">
            <Link to="/auth" className="btn btn-primary hero-cta-primary">
              Start sketching — free
            </Link>
            <a href="#workflow" className="btn btn-secondary">
              See it in a session
            </a>
          </motion.div>

          <motion.p {...stagger(4)} className="hero-note">
            No credit card · Free to start · Works in your browser
          </motion.p>
        </div>

        <motion.div
          className="hero-demo"
          initial={reduce ? false : { opacity: 0, y: 32, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.55, ease: copyEase }}
        >
          <DemoCanvas />
        </motion.div>
      </div>
    </section>
  );
}