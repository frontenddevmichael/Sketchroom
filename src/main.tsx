import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { convex } from './lib/convex-client';
import { AppProviders } from './lib/AppProviders';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <AppProviders />
      </BrowserRouter>
    </ConvexAuthProvider>
  </StrictMode>
);
