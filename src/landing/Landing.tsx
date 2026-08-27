import { MotionConfig } from 'framer-motion';
import { useLenis } from './lib/useLenis';
import { usePageTitle } from '../lib/usePageTitle';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Positioning } from './sections/Positioning';
import { LazyMount } from './components/LazyMount';
import { FeatureShowcase } from './sections/FeatureShowcase';
import { Walkthrough } from './sections/Walkthrough';
import { PerformanceSection } from './sections/PerformanceSection';
import { Pricing } from './sections/Pricing';
import { ComparisonTable } from './sections/ComparisonTable';
import { SocialProof } from './sections/SocialProof';
import { Faq } from './sections/Faq';
import { FinalCta } from './sections/FinalCta';
import { Footer } from './sections/Footer';
import './Landing.css';

export function Landing() {
  usePageTitle('Sketchroom — The design agent for every step');
  useLenis();

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-page">
        <Nav />
        <main>
          <Hero />
          <Positioning />
          <FeatureShowcase />
          <LazyMount>
            <Walkthrough />
          </LazyMount>
          <div className="section-divider" aria-hidden="true" />
          <LazyMount>
            <PerformanceSection />
          </LazyMount>
          <div className="section-divider" aria-hidden="true" />
          <LazyMount>
            <Pricing />
          </LazyMount>
          <LazyMount>
            <ComparisonTable />
          </LazyMount>
          <LazyMount>
            <SocialProof />
          </LazyMount>
          <LazyMount>
            <Faq />
          </LazyMount>
          <LazyMount>
            <FinalCta />
          </LazyMount>
        </main>
        <Footer />
      </div>
    </MotionConfig>
  );
}
