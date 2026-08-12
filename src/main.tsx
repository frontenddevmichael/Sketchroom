import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import { ConvexClerkWrapper } from './lib/convex-wrapper';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string}>
      <BrowserRouter>
        <ConvexClerkWrapper />
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>
);