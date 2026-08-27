import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConvexAuth } from '@convex-dev/auth/react';
import { Menu, X } from 'lucide-react';
import './Nav.css';

const LINKS = [
  { href: '#positioning', label: 'Product' },
  { href: '#features', label: 'Agents' },
  { href: '#workflow', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
];

export function Nav() {
  const { isAuthenticated } = useConvexAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll-spy: track which section is in view
  useEffect(() => {
    const sectionIds = LINKS.map((l) => l.href.replace('#', ''));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const setLinkRef = useCallback((id: string) => (el: HTMLAnchorElement | null) => {
    if (el) linkRefs.current.set(id, el);
  }, []);

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
      <div className="nav-inner">
        <Link to="/" className="nav-logo" aria-label="Sketchroom home">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3l1.9 5.6L19.5 10l-4.5 2.1L12 18l-3-5.9L4.5 10l5.6-1.4z" fill="var(--green-500)" stroke="var(--green-500)" />
          </svg>
          <span className="nav-logo-text">Sketchroom</span>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              ref={setLinkRef(l.href.replace('#', ''))}
              className={`nav-link${activeSection === l.href.replace('#', '') ? ' nav-link--active' : ''}`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="nav-actions">
          {isAuthenticated ? (
            <Link to="/dashboard" className="nav-cta">Open Sketchroom</Link>
          ) : (
            <>
              <Link to="/auth" className="nav-signin">Sign in</Link>
              <Link to="/auth" className="nav-cta">Get started</Link>
            </>
          )}

          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <div className={`nav-mobile ${menuOpen ? 'nav-mobile--open' : ''}`}>
        <nav aria-label="Mobile navigation">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="nav-mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="nav-mobile-divider" />
          {isAuthenticated ? (
            <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="nav-mobile-cta">
              Open Sketchroom
            </Link>
          ) : (
            <Link to="/auth" onClick={() => setMenuOpen(false)} className="nav-mobile-cta">
              Get started — free
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
