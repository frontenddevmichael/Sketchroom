import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { convex } from './lib/convex-client';
import { AppProviders } from './lib/AppProviders';
import { initSentry } from './lib/sentry';
// Self-hosted Geist: the typeface is part of the design system (design/SKILL.md),
// so it ships with the bundle instead of a third-party font CDN.
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './index.css';

// Initialize Sentry early
initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <AppProviders />
      </BrowserRouter>
    </ConvexAuthProvider>
  </StrictMode>
);
