import { useCallback, useEffect, useRef, type RefObject, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const PRODUCT_LINKS: { href: string; label: string }[] = [
  { href: '#product', label: 'Product' },
  { href: '#workflow', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
  { href: '#trust', label: 'Why trust it' },
];

const WORDMARK = 'Sketchroom';

/**
 * Draws an SVG path in as it enters the viewport, like a pen tracing
 * it live. Falls back to a fully-drawn, static line if the user
 * prefers reduced motion, or if IntersectionObserver isn't available.
 * Shared by the wordmark underline and the CTA scribble so both use
 * the same hand-drawn reveal rather than two different techniques.
 */
function useDrawReveal(threshold = 0.6): RefObject<SVGPathElement | null> {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return undefined;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;

    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      path.style.strokeDashoffset = '0';
      return undefined;
    }

    path.style.strokeDashoffset = `${length}`;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          path.style.strokeDashoffset = '0';
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(path);
    return () => observer.disconnect();
  }, [threshold]);

  return pathRef;
}

/**
 * Lays down a fading pencil trail wherever the cursor moves inside
 * the footer, on a transparent canvas that sits behind the content.
 * Skipped entirely for touch pointers and reduced-motion users, since
 * there's no cursor to trail and no reason to animate for them.
 */
function usePencilTrail(
  footerRef: RefObject<HTMLElement | null>
): RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const footer = footerRef.current;
    if (!canvas || !footer) return undefined;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    if (prefersReducedMotion || isCoarsePointer) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Read the real brand green once, rather than hardcoding a hex
    // that could drift from the design tokens.
    const strokeColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--green-500')
        .trim() || '#22c55e';

    function resize() {
      const rect = footer.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    let points: { x: number; y: number; life: number }[] = [];
    let rafId: number | null = null;
    let running = false;

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      for (let i = 1; i < points.length; i += 1) {
        const prev = points[i - 1];
        const curr = points[i];
        const alpha = Math.max(0, curr.life);
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha * 0.55;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.6 + alpha * 2;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      points = points
        .map((p) => ({ ...p, life: p.life - 0.025 }))
        .filter((p) => p.life > 0);

      if (points.length > 1) {
        rafId = requestAnimationFrame(draw);
      } else {
        running = false;
        rafId = null;
      }
    }

    function handlePointerMove(event: PointerEvent) {
      const rect = footer.getBoundingClientRect();
      points.push({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        life: 1,
      });
      if (points.length > 80) points.shift();

      if (!running) {
        running = true;
        rafId = requestAnimationFrame(draw);
      }
    }

    footer.addEventListener('pointermove', handlePointerMove);

    return () => {
      footer.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', resize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [footerRef]);

  return canvasRef;
}

/**
 * "Undo" replaces the usual back-to-top link: a wavy pen stroke draws
 * itself up the full page in sync with the scroll, so leaving the
 * footer visually retraces the journey instead of just jumping.
 * Falls back to an instant scroll for reduced-motion users.
 */
function useUndoScrollToTop() {
  return useCallback(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    const svgNS = 'http://www.w3.org/2000/svg';
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const overlay = document.createElement('div');
    overlay.className = 'footer-undo-overlay';

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'footer-undo-svg');
    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');

    // Build a gentle zigzag from the bottom-right (near the Undo
    // control) up to the top of the viewport.
    const segments = 7;
    let d = `M ${vw * 0.88} ${vh}`;
    for (let i = 1; i <= segments; i += 1) {
      const y = vh - (vh / segments) * i;
      const controlY = y + vh / segments / 2;
      const towardEdge = i % 2 === 0 ? vw * 0.92 : vw * 0.7;
      const endX = i % 2 === 0 ? vw * 0.68 : vw * 0.9;
      d += ` Q ${towardEdge} ${controlY}, ${endX} ${y}`;
    }

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'footer-undo-path');
    svg.appendChild(path);
    overlay.appendChild(svg);
    document.body.appendChild(overlay);

    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    // Force a reflow so the initial dash offset is committed before animating.
    // eslint-disable-next-line no-unused-expressions
    path.getBoundingClientRect();

    const duration = 720;
    const startY = window.scrollY;
    const startTime = performance.now();

    function step(now: number) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - (1 - t) ** 3;
      path.style.strokeDashoffset = `${length * (1 - eased)}`;
      window.scrollTo(0, startY * (1 - eased));

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        overlay.remove();
      }
    }

    requestAnimationFrame(step);
  }, []);
}

export function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  const squigglePathRef = useDrawReveal(0.6);
  const scribblePathRef = useDrawReveal(0.8);
  const trailCanvasRef = usePencilTrail(footerRef);
  const handleUndo = useUndoScrollToTop();

  return (
    <footer className="landing-footer" ref={footerRef}>
      <canvas className="landing-footer-canvas" ref={trailCanvasRef} aria-hidden="true" />

      <div className="landing-footer-content">
        <div className="landing-footer-cta">
          <div className="landing-footer-cta-text">
            <span className="landing-footer-eyebrow">Before you go</span>
            <p className="landing-footer-cta-headline">
              Let&rsquo;s{' '}
              <span className="landing-footer-cta-highlight">
                sketch it out
                <svg
                  className="landing-footer-cta-scribble"
                  viewBox="0 0 340 60"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    ref={scribblePathRef}
                    d="M10 34 C 4 14, 40 4, 90 6 S 220 2, 280 10 S 336 22, 326 36 S 240 54, 160 52 S 20 50, 12 38 S 30 20, 60 18"
                    fill="none"
                    stroke="var(--green-500)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              .
            </p>
          </div>
          <Link to="/auth" className="landing-footer-cta-button">
            Start free
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 7h9M7.5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <div className="landing-footer-inner">
          <div className="landing-footer-col">
            <h4 className="landing-footer-heading">Product</h4>
            <ul className="landing-footer-list">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="landing-footer-link">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div className="landing-footer-col">
            <h4 className="landing-footer-heading">Get started</h4>
            <ul className="landing-footer-list">
              <li><Link to="/auth" className="landing-footer-link">Sign in</Link></li>
              <li><Link to="/auth" className="landing-footer-link">Start free</Link></li>
              <li><Link to="/dashboard" className="landing-footer-link">Open the app</Link></li>
            </ul>
          </div>

          <p className="landing-footer-tagline">
            A real-time canvas with an AI copilot in the room.
          </p>
        </div>

        <div className="landing-footer-mark">
          <span className="landing-footer-mark-text" aria-label={WORDMARK}>
            {WORDMARK.split('').map((char, i) => (
              <span
                key={`${char}-${i}`}
                className="landing-footer-mark-letter"
                style={{ '--i': i } as CSSProperties}
                aria-hidden="true"
              >
                {char}
              </span>
            ))}
          </span>
          <svg
            className="landing-footer-mark-squiggle"
            viewBox="0 0 1160 40"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              ref={squigglePathRef}
              d="M4 24 C 120 4, 220 4, 300 22 S 480 40, 560 20 S 740 2, 820 20 S 1000 38, 1080 18 S 1140 10, 1156 20"
              fill="none"
              stroke="var(--green-500)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="landing-footer-bottom">
          <span>© {new Date().getFullYear()} Sketchroom</span>
          <span className="landing-footer-made">Made for teams who sketch it first.</span>
          <button type="button" className="landing-footer-top" onClick={handleUndo}>
            Back to top
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path
                d="M3 4.5H8.2a2.8 2.8 0 0 1 0 5.6H4.5M3 4.5 5.3 2.3M3 4.5l2.3 2.2"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </footer>
  );
}