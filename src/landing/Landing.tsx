import { MotionConfig } from 'framer-motion';
import { useLenis } from './lib/useLenis';
import { usePageTitle } from '../lib/usePageTitle';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { LazyMount } from './components/LazyMount';
import { FeatureShowcase } from './sections/FeatureShowcase';
import { PerformanceSection } from './sections/PerformanceSection';
import { ComparisonTable } from './sections/ComparisonTable';
import { SocialProof } from './sections/SocialProof';
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
          <FeatureShowcase />
          <LazyMount>
            <PerformanceSection />
          </LazyMount>
          <LazyMount>
            <ComparisonTable />
          </LazyMount>
          <LazyMount>
            <SocialProof />
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
