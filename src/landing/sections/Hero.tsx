import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { DemoCanvas } from '../demo/DemoCanvas';
import './Hero.css';

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const reduce = useReducedMotion();
  const demoRef = useRef<HTMLDivElement>(null);
  const [demoVisible, setDemoVisible] = useState(false);

  useEffect(() => {
    const el = demoRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setDemoVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="hero" id="top">
      {/* Background rings — Framer's signature concentric circles */}
      <div className="hero-rings" aria-hidden="true">
        <motion.span
          className="hero-ring hero-ring-1"
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.2, ease }}
        />
        <motion.span
          className="hero-ring hero-ring-2"
          initial={reduce ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.3, delay: 0.35, ease }}
        />
      </div>

      <div className="hero-content">
        {/* Headline — the opening breath */}
        <motion.h1
          className="hero-title"
          initial={reduce ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease }}
        >
          The design agent for every step from idea to launch.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="hero-sub"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease }}
        >
          Send ideas to your copilot. It sketches the first pass.
          Your team refines it live. You leave with something you can act on.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="hero-actions"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease }}
        >
          <Link to="/auth" className="btn btn-primary hero-primary">
            Get started free
          </Link>
          <Link to="/auth" className="btn btn-secondary hero-secondary">
            Download app
          </Link>
        </motion.div>

        {/* Trust badge — static, no fake counters */}
        <motion.div
          className="hero-badge"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55, ease }}
        >
          <span className="hero-badge-dot" />
          <span className="hero-badge-text">
            Trusted by teams shipping real products
          </span>
        </motion.div>

        {/* Demo canvas — the product reveal */}
        <motion.div
          ref={demoRef}
          className={`hero-demo ${demoVisible ? 'hero-demo--visible' : ''}`}
          initial={reduce ? false : { opacity: 0, y: 48, scale: 0.97 }}
          animate={demoVisible ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <DemoCanvas />
        </motion.div>
      </div>
    </section>
  );
}
