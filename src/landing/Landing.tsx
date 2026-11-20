import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Accordion from '@radix-ui/react-accordion';
import { Box, History, Users } from 'lucide-react';
import {
  EmptyAi,
  EmptyHistory,
  HeroDraftingTable,
} from '../illustration';
import { FREE_AI_LIMIT, FREE_COLLABORATORS_PER_ROOM, FREE_ROOM_LIMIT } from '../lib/plans';
import { usePageTitle } from '../lib/usePageTitle';
import { Button, IconTile, Tag } from '../ui';
import { LazyMount } from './components/LazyMount';
import { DemoCanvas } from './demo/DemoCanvas';
import { useLenis } from './lib/useLenis';
import './landing.css';

const NAV_LINKS = [
  { label: 'Product', href: '#product' },
  { label: 'How it works', href: '#demo' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

/** The hero scene performs the product's one gesture: a proposal commits. */
function useCommitted() {
  // Reduced motion skips the performance: the block is already committed.
  const [committed, setCommitted] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (committed) return;
    const timer = window.setTimeout(() => setCommitted(true), 1600);
    return () => window.clearTimeout(timer);
  }, [committed]);

  return committed;
}

function Faq() {
  const items = [
    {
      q: 'What is Sketchroom?',
      a: 'A collaborative canvas for planning software: architecture sketches, flows and system diagrams, with an AI copilot that proposes changes to the same canvas your team is drawing on.',
    },
    {
      q: 'How is this different from a whiteboard?',
      a: 'A whiteboard has one state: drawn. Sketchroom has two. Anything the copilot offers arrives dashed and is not part of the board until someone accepts it; accepting it is a commit, and every commit is a snapshot you can return to.',
    },
    {
      q: 'Does the AI change my canvas without asking?',
      a: 'No. It draws dashed proposals in a separate layer. Nothing it produces becomes part of the document until you accept it, and you can discard a proposal without touching the board.',
    },
    {
      q: 'Can I get my work out?',
      a: 'Every room keeps a history of committed snapshots, and the board is yours to export. There is no lock-in mechanism and no proprietary format holding your diagrams hostage.',
    },
    {
      q: 'What does the free plan include?',
      a: `Up to ${FREE_ROOM_LIMIT} rooms, ${FREE_COLLABORATORS_PER_ROOM} collaborators per room, and ${FREE_AI_LIMIT} AI actions a month. No card required.`,
    },
  ];

  return (
    <Accordion.Root type="single" collapsible className="lp-faq">
      {items.map((item, i) => (
        <Accordion.Item key={item.q} value={`item-${i}`} className="lp-faq__item">
          <Accordion.Header>
            <Accordion.Trigger className="lp-faq__trigger">
              {item.q}
              <span className="lp-faq__sign" aria-hidden="true">
                +
              </span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="lp-faq__content">
            <p>{item.a}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}

function Wordmark() {
  return (
    <span className="lp-wordmark">
      <svg className="lp-wordmark__mark" viewBox="0 0 18 18" aria-hidden="true">
        <path
          d="M9 1.2 16.2 5.4v7.2L9 16.8 1.8 12.6V5.4Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        <path d="M9 1.2v15.6M1.8 5.4 9 9.6l7.2-4.2" fill="none" stroke="currentColor" strokeWidth="1.25" />
      </svg>
      Sketchroom
    </span>
  );
}

export function Landing() {
  usePageTitle('Sketchroom — draw the plan before you build the product');
  useLenis();
  const navigate = useNavigate();
  const committed = useCommitted();
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollToDemo = useCallback(() => {
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="lp">
      <a href="#main" className="lp-skip">
        Skip to content
      </a>
      <header className="lp-nav">
        <div className="lp-shell lp-nav__inner">
          <Link to="/" className="lp-wordmark" aria-label="Sketchroom home">
            <Wordmark />
          </Link>
          <nav className="lp-nav__links" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="lp-nav__link">
                {link.label}
              </a>
            ))}
          </nav>
          <span className="lp-nav__cta">
            <Button onClick={() => navigate('/auth')}>Start sketching</Button>
          </span>
          <button
            type="button"
            className="lp-nav__menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="lp-drawer"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              {menuOpen ? (
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="lp-nav__drawer" id="lp-drawer">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="lp-nav__link"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Button onClick={() => navigate('/auth')}>Start sketching</Button>
          </div>
        )}
      </header>

      <main id="main">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="lp-hero">
          <div className="lp-shell">
            <div className="lp-hero__grid">
              <div className="lp-hero__copy">
                <Tag>dashed = proposed · solid = committed</Tag>
                <h1 className="lp-h1">Draw the plan before you build the product.</h1>
                <p className="lp-lead">
                  A live canvas where your team sketches architecture and the AI proposes in
                  dashed lines, until you commit it in ink.
                </p>
                <div className="lp-actions">
                  <Button onClick={() => navigate('/auth')}>Start sketching</Button>
                  <Button variant="secondary" arrow={false} onClick={scrollToDemo}>
                    Watch a room
                  </Button>
                </div>
                <p className="lp-note">
                  Free for {FREE_ROOM_LIMIT} rooms · {FREE_COLLABORATORS_PER_ROOM} collaborators
                  each · no card
                </p>
              </div>

              <div className="lp-hero__scene">
                <HeroDraftingTable
                  state={committed ? 'committed' : 'draft'}
                  caption={<Tag accent>{committed ? 'committed' : 'proposing'}</Tag>}
                />
                <span className="lp-hero__caption">
                  <Tag>live, 2 cursors</Tag>
                </span>
              </div>
            </div>

            <div className="lp-tiles">
              <IconTile
                icon={<Users size={20} />}
                label="Live by default"
                description="Cursors, presence, no refresh"
              />
              <IconTile
                icon={<Box size={20} />}
                label="AI that shows its work"
                description="Dashed proposals, never edits"
              />
              <IconTile
                icon={<History size={20} />}
                label="Every change reversible"
                description="Commit, then restore any snapshot"
              />
            </div>
          </div>
        </section>

        {/* ── Feature cells ────────────────────────────────────────────── */}
        <section className="lp-section" id="product">
          <div className="lp-shell">
            <div className="lp-section__head">
              <Tag>the grammar</Tag>
              <h2 className="lp-h2">Two states, and you can see which one you are in.</h2>
              <p className="lp-copy">
                Line weight is state. A dashed shape is a proposal that does not exist yet. A
                solid shape is committed work. Everything else in the product follows from that.
              </p>
            </div>

            <div className="lp-features">
              <article className="lp-feature">
                <h3 className="lp-feature__title">Live canvas</h3>
                <p className="lp-feature__desc">
                  Draw with your team on one board. Presence is real, not a refresh button.
                </p>
                <div className="lp-feature__scene">
                  <HeroDraftingTable state="committed" />
                </div>
              </article>

              <article className="lp-feature">
                <h3 className="lp-feature__title">Glass-box copilot</h3>
                <p className="lp-feature__desc">
                  Ask for a flow and get it dashed. Accept to commit it, discard to keep the board
                  untouched.
                </p>
                <div className="lp-feature__scene">
                  <EmptyAi />
                </div>
              </article>

              <article className="lp-feature">
                <h3 className="lp-feature__title">Time stack</h3>
                <p className="lp-feature__desc">
                  Every commit is a snapshot. Scrub back, restore the one that was right.
                </p>
                <div className="lp-feature__scene">
                  <EmptyHistory />
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ── Real product moment ──────────────────────────────────────── */}
        <section className="lp-section" id="demo">
          <div className="lp-shell">
            <div className="lp-section__head">
              <Tag>try it here</Tag>
              <h2 className="lp-h2">Dashed until you say so.</h2>
              <p className="lp-copy">
                This is the canvas, running without an account. Drag a block, ask the copilot for
                a proposal, and commit it when it is right.
              </p>
            </div>

            <LazyMount>
              <div className="lp-demo">
                <div className="lp-demo__bar">
                  <span className="lp-demo__label">live demo — no account</span>
                  <Tag solid>scripted copilot</Tag>
                </div>
                <div className="lp-demo__body">
                  <DemoCanvas />
                </div>
                <div className="lp-demo__foot">
                  <Tag>drag a block</Tag>
                  <Tag>ask the copilot</Tag>
                  <Tag>accept to commit</Tag>
                </div>
              </div>
            </LazyMount>
          </div>
        </section>

        {/* ── Grammar comparison ───────────────────────────────────────── */}
        <section className="lp-section">
          <div className="lp-shell">
            <div className="lp-section__head">
              <Tag>why it holds up</Tag>
              <h2 className="lp-h2">What changes when a board has a commit.</h2>
            </div>

            <div className="lp-grammar">
              <div className="lp-grammar__col">
                <div className="lp-grammar__label">
                  <Tag>a whiteboard</Tag>
                </div>
                <ul className="lp-grammar__list">
                  <li>
                    <span className="lp-grammar__mark">—</span> Everything drawn is equally final.
                  </li>
                  <li>
                    <span className="lp-grammar__mark">—</span> An AI edit is indistinguishable from
                    your own.
                  </li>
                  <li>
                    <span className="lp-grammar__mark">—</span> History is a list of autosaves.
                  </li>
                </ul>
              </div>

              <div className="lp-grammar__col">
                <div className="lp-grammar__label">
                  <Tag accent>sketchroom</Tag>
                </div>
                <ul className="lp-grammar__list">
                  <li>
                    <span className="lp-grammar__mark">+</span> Proposed and committed are visually
                    different states.
                  </li>
                  <li>
                    <span className="lp-grammar__mark">+</span> The copilot cannot commit anything
                    itself.
                  </li>
                  <li>
                    <span className="lp-grammar__mark">+</span> History is a stack of decisions you
                    can restore.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────────────────────────── */}
        <section className="lp-section" id="pricing">
          <div className="lp-shell">
            <div className="lp-section__head">
              <Tag>pricing</Tag>
              <h2 className="lp-h2">Start free. Pay when the team joins.</h2>
            </div>

            <div className="lp-plans">
              <div className="lp-plan">
                <h3 className="lp-plan__name">Free</h3>
                <p className="lp-plan__price">
                  $0<small>forever</small>
                </p>
                <ul className="lp-plan__list">
                  <li>{FREE_ROOM_LIMIT} rooms</li>
                  <li>{FREE_COLLABORATORS_PER_ROOM} collaborators per room</li>
                  <li>{FREE_AI_LIMIT} AI actions a month</li>
                  <li>Full canvas and full history</li>
                </ul>
                <div className="lp-plan__cta">
                  <Button onClick={() => navigate('/auth')}>Start sketching</Button>
                </div>
              </div>

              <div className="lp-plan lp-plan--featured">
                <h3 className="lp-plan__name">Team</h3>
                <p className="lp-plan__price">
                  Custom<small>per workspace</small>
                </p>
                <ul className="lp-plan__list">
                  <li>Unlimited rooms and collaborators</li>
                  <li>Higher AI allowance</li>
                  <li>Shared workspace history</li>
                  <li>Priority support</li>
                </ul>
                <div className="lp-plan__cta">
                  <Button variant="ghost" arrow onClick={() => navigate('/auth?plan=team')}>
                    Request access
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="lp-section" id="faq">
          <div className="lp-shell">
            <div className="lp-section__head">
              <Tag>questions</Tag>
              <h2 className="lp-h2">The things people ask before signing up.</h2>
            </div>
            <Faq />
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────── */}
        <section className="lp-cta">
          <div className="lp-shell">
            <div className="lp-cta__inner">
              <Tag>no card required</Tag>
              <h2 className="lp-cta__title">Draw the plan first.</h2>
              <Button onClick={() => navigate('/auth')}>Start sketching</Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-shell">
          <div className="lp-footer__top">
            <div className="lp-footer__brand">
              <span className="lp-footer__wordmark">Sketchroom</span>
              <p className="lp-footer__tagline">think together, in the open.</p>
            </div>
            <div className="lp-footer__links">
              <div className="lp-footer__group">
                <h4>Product</h4>
                <a href="#product">Product</a>
                <a href="#pricing">Pricing</a>
                <a href="#faq">FAQ</a>
              </div>
              <div className="lp-footer__group">
                <h4>Legal</h4>
                <Link to="/terms">Terms</Link>
                <Link to="/privacy">Privacy</Link>
                <Link to="/auth">Sign in</Link>
              </div>
            </div>
          </div>
          <div className="lp-footer__bottom">
            <span>© {new Date().getFullYear()} Sketchroom</span>
            <span>built in the open</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
