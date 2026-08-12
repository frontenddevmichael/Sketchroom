import { Link } from 'react-router-dom';
import './Footer.css';

const PRODUCT_LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#workflow', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
  { href: '#trust', label: 'Why trust it' },
];

export function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <div className="landing-footer-brand">
          <Link to="/" className="landing-logo" aria-label="Sketchroom home">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3l1.9 5.6L19.5 10l-4.5 2.1L12 18l-3-5.9L4.5 10l5.6-1.4z" fill="var(--green-500)" stroke="var(--green-500)" />
            </svg>
            <span className="landing-logo-name">Sketchroom</span>
          </Link>
          <p className="landing-footer-tagline">
            Plan it together, live. A real-time canvas with an AI copilot in the room.
          </p>
        </div>

        <div className="landing-footer-cols">
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
        </div>
      </div>

      <div className="landing-footer-bottom">
        <span>© {new Date().getFullYear()} Sketchroom</span>
        <span className="landing-footer-made">Made for teams who sketch it first.</span>
        <a href="#top" className="landing-footer-top">
          Back to top
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </footer>
  );
}