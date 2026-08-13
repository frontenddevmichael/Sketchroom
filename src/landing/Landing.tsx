import { lazy, Suspense } from 'react';
import { MotionConfig } from 'framer-motion';
import { useLenis } from './lib/useLenis';
import { usePageTitle } from '../lib/usePageTitle';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Positioning } from './sections/Positioning';
import { FeatureShowcase } from './sections/FeatureShowcase';

import { Faq } from './sections/Faq';
import { Trust } from './sections/Trust';
import { FinalCta } from './sections/FinalCta';
import { Footer } from './sections/Footer';
import { LazyMount } from './components/LazyMount';
import './Landing.css';

/**
 * Walkthrough pulls in gsap + ScrollTrigger (~64 kB gzip). It only renders its
 * pinned animation once it nears the viewport, so the landmark sections above
 * the fold stay lean.
 */
const Walkthrough = lazy(() =>
  import('./sections/Walkthrough').then((m) => ({ default: m.Walkthrough })),
);

export function Landing() {
  usePageTitle('Sketchroom — Plan it together, live');
  useLenis();

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-page">
        <Nav />
        <main>
          <Hero />
          <Positioning />
          <FeatureShowcase />
          <LazyMount className="wt-lazy-slot">
            <Suspense fallback={<div className="wt-pending" aria-hidden="true" />}>
              <Walkthrough />
            </Suspense>
          </LazyMount>
          <Faq />
          <Trust />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  );
}