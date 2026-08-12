import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConvexAuth } from 'convex/react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { Menu, X, Moon, Sun } from 'lucide-react';
import { getLenis } from '../lib/useLenis';
import { useTheme } from '../../lib/useTheme';
import './Nav.css';

const LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#workflow', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export function Nav() {
  const { isAuthenticated } = useConvexAuth();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Scroll-spy: the section currently in view highlights its nav link, so the
  // nav reads as a live map of the page rather than static anchors.
  const [activeSection, setActiveSection] = useState<string | null>(null);
  // The scroll-spy indicator is one bar that glides between links (spring
  // easing) rather than each link re-drawing its own underline — the nav
  // reads as a live map, not a sequence of pop-ins.
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const linksRef = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();

  // Scroll-spy reads live section rects instead of IntersectionObserver: the
  // pinned walkthrough holds its section motionless against the viewport for
  // five viewport-heights, so an observer never fires and the nav would stay
  // stuck on the wrong link the whole time. Measuring the reading band each
  // scroll (rAF-coalesced) keeps the nav an accurate map through the pin.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setScrolled(window.scrollY > 24);
        // A band just above the fold: a section counts as "current" once it
        // owns the reading zone, not the instant its top pixel peeks in.
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

  // Position the gliding indicator under the active link, in the links
  // container's coordinate space. Re-measured on resize so it tracks.
  useEffect(() => {
    if (!activeSection) return;
    const measure = () => {
      const container = linksRef.current;
      const active = container?.querySelector(`a[href="${activeSection}"]`);
      if (!container || !active) return;
      const cr = container.getBoundingClientRect();
      const ar = active.getBoundingClientRect();
      setIndicator((prev) =>
        prev && Math.abs(prev.left - (ar.left - cr.left)) < 1 && Math.abs(prev.width - ar.width) < 1
          ? prev
          : { left: ar.left - cr.left, width: ar.width }
      );
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeSection]);

  // Close the mobile menu when a link is chosen (anchor or route).
  const closeMenu = () => setMenuOpen(false);

  // Escape closes the menu; clicks anywhere else outside the menu do too.
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
      className={`landing-nav ${scrolled ? 'landing-nav-scrolled' : ''}`}
      initial={reduce ? false : { opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="landing-nav-inner">
        <Link to="/" className="landing-logo" aria-label="Sketchroom home">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l1.9 5.6L19.5 10l-4.5 2.1L12 18l-3-5.9L4.5 10l5.6-1.4z" fill="var(--green-500)" stroke="var(--green-500)" />
          </svg>
          <span className="landing-logo-name">Sketchroom</span>
        </Link>

        <nav className="landing-nav-links" aria-label="Primary" ref={linksRef}>
          <span
            className="landing-nav-indicator"
            aria-hidden="true"
            style={indicator ? { left: indicator.left, width: indicator.width } : undefined}
          />
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={goTo(l.href)}
              className={`landing-nav-link ${activeSection === l.href ? 'active' : ''}`}
              aria-current={activeSection === l.href ? 'true' : undefined}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="landing-nav-cta">
          {/* The site proves the product: the same theme system the app uses,
              toggled live, right here on the landing page. */}
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
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {LINKS.map((l) => (
              <a
                key={l.href}
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