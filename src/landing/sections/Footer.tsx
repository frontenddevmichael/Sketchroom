import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const FOOTER_COLS = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '#product' },
      { label: 'Performance', href: '#performance' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Changelog', href: '#' },
      { label: 'Roadmap', href: '#' },
    ],
  },
  {
    heading: 'Solutions',
    links: [
      { label: 'For teams', href: '#' },
      { label: 'For architects', href: '#' },
      { label: 'For PMs', href: '#' },
      { label: 'Enterprise', href: '#' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Documentation', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Guides', href: '#' },
      { label: 'API reference', href: '#' },
      { label: 'Community', href: '#' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Contact', href: '#' },
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
    ],
  },
];

/* Live-updating token counter — kinetic detail in footer */
function useFooterCounter(target: number, duration = 2400) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setCount(Math.floor(t * target));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return count;
}

export function Footer() {
  const tokens = useFooterCounter(12847, 2400);

  return (
    <footer className="footer">
      <div className="footer-inner">
        {/* Top CTA row */}
        <div className="footer-top">
          <div className="footer-top-text">
            <p className="footer-top-headline">
              Let&rsquo;s <span className="footer-top-highlight">sketch it out</span>.
            </p>
          </div>
          <Link to="/auth" className="footer-top-cta">
            Start free
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 7h9M7.5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* Live token counter — Framer-style kinetic detail */}
        <div className="footer-counter">
          <span className="footer-counter-dot" />
          <span className="footer-counter-text">
            <strong>{tokens.toLocaleString()}</strong> AI tokens generated this week
          </span>
        </div>

        {/* Columns */}
        <div className="footer-columns">
          {FOOTER_COLS.map((col) => (
            <div key={col.heading} className="footer-col">
              <h4 className="footer-col-heading">{col.heading}</h4>
              <ul className="footer-col-list">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="footer-link">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Wordmark */}
        <div className="footer-wordmark" aria-label="Sketchroom">
          Sketchroom
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} Sketchroom</span>
          <span className="footer-bottom-tagline">Made for teams who sketch it first.</span>
          <button type="button" className="footer-top-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Back to top
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M3 4.5H8.2a2.8 2.8 0 0 1 0 5.6H4.5M3 4.5 5.3 2.3M3 4.5l2.3 2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </footer>
  );
}
