import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConvexAuth } from '@convex-dev/auth/react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { Menu, X, Moon, Sun } from 'lucide-react';
import { getLenis } from '../lib/useLenis';
import { useTheme } from '../../lib/useTheme';
import './Nav.css';

const LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#workflow', label: 'How it works' },
  { href: '#faq', label: 'FAQ' },
];

export function Nav() {
  const { isAuthenticated } = useConvexAuth();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  // Now a filled capsule sliding behind the active link, not an underline —
  // same measurement, different render target.
  const [highlight, setHighlight] = useState<{ left: number; width: number } | null>(null);
  const linksRef = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setScrolled(window.scrollY > 24);
        const bandTop = window.innerHeight * 0.35;
        const bandBottom = window.innerHeight * 0.45;
        let current: string | null = null;
        for (const l of LINKS) {
          const el = document.getElementById(l.href.slice(1));
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (r.top < bandBottom && r.bottom > bandTop) current = l.href;
        }
        setActiveSection(current);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!activeSection) return;
    const measure = () => {
      const container = linksRef.current;
      const active = container?.querySelector(`a[href="${activeSection}"]`);
      if (!container || !active) return;
      const cr = container.getBoundingClientRect();
      const ar = active.getBoundingClientRect();
      setHighlight((prev) =>
        prev && Math.abs(prev.left - (ar.left - cr.left)) < 1 && Math.abs(prev.width - ar.width) < 1
          ? prev
          : { left: ar.left - cr.left, width: ar.width }
      );
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeSection]);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const goTo = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (href.startsWith('#') && window.location.pathname === '/') {
      e.preventDefault();
      const lenis = getLenis();
      if (lenis) {
        lenis.scrollTo(href, { offset: -72 });
      } else {
        document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    closeMenu();
  };

  return (
    <motion.header
      className="landing-nav-shell"
      initial={reduce ? false : { opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={`landing-nav-pill ${scrolled ? 'is-docked' : ''}`}>
        <Link to="/" className="landing-logo" aria-label="Sketchroom home">
          <svg
            className="landing-logo-mark"
            width="20"
            height="20"
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
          <span className="landing-logo-name">Sketchroom</span>
        </Link>

        <nav className="landing-nav-links" aria-label="Primary" ref={linksRef}>
          <span
            className="landing-nav-highlight"
            aria-hidden="true"
            style={highlight ? { left: highlight.left, width: highlight.width } : undefined}
          />
          {LINKS.map((l) => (
            
           <a   key={l.href}
              href={l.href}
              onClick={goTo(l.href)}
              className={`landing-nav-link ${activeSection === l.href ? 'active' : ''}`}
              aria-current={activeSection === l.href ? 'true' : undefined}
            >
              {l.label}
              {activeSection === l.href && <span className="landing-nav-live-dot" aria-hidden="true" />}
            </a>
          ))}
        </nav>

        <div className="landing-nav-divider" aria-hidden="true" />

        <div className="landing-nav-cta">
          <button
            className="landing-nav-theme"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn btn-primary landing-nav-cta-btn">
              Open Sketchroom
            </Link>
          ) : (
            <>
              <Link to="/auth" className="landing-nav-link landing-nav-signin">
                Sign in
              </Link>
              <Link to="/auth" className="btn btn-primary landing-nav-cta-btn">
                Start free
              </Link>
            </>
          )}
        </div>

        <button
          className="landing-nav-menu-btn"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            className="landing-nav-menu glass"
            role="menu"
            aria-label="Mobile navigation"
            initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {LINKS.map((l) => (
              
              <a  key={l.href}
                href={l.href}
                onClick={goTo(l.href)}
                className={`landing-nav-menu-link ${activeSection === l.href ? 'active' : ''}`}
                role="menuitem"
              >
                {l.label}
              </a>
            ))}
            <div className="landing-nav-menu-divider" aria-hidden="true" />
            <button
              className="landing-nav-menu-theme"
              onClick={() => {
                toggleTheme();
                closeMenu();
              }}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              {theme === 'light' ? 'Dark mode' : 'Light mode'}
            </button>
            <div className="landing-nav-menu-divider" aria-hidden="true" />
            {isAuthenticated ? (
              <Link to="/dashboard" onClick={closeMenu} className="landing-nav-menu-cta btn btn-primary">
                Open Sketchroom
              </Link>
            ) : (
              <>
                <Link to="/auth" onClick={closeMenu} className="landing-nav-menu-cta btn btn-primary">
                  Start free
                </Link>
                <Link to="/auth" onClick={closeMenu} className="landing-nav-menu-signin">
                  Sign in
                </Link>
              </>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}