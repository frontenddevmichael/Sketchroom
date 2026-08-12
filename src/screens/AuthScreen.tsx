import { useConvexAuth } from 'convex/react';
import { SignInButton } from '@clerk/react';
import { LoadingScreen } from '../components/LoadingScreen';
import { usePageTitle } from '../lib/usePageTitle';
import { DemoCanvas } from '../landing/demo/DemoCanvas';
import '../components/shared.css';
import './AuthScreen.css';

function GoogleGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.48 48 24 48z" />
    </svg>
  );
}

function LogoGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.6L19.5 10l-4.5 2.1L12 18l-3-5.9L4.5 10l5.6-1.4z" fill="var(--green-500)" stroke="var(--green-500)" />
    </svg>
  );
}

export function AuthScreen() {
  usePageTitle('Sign in — Sketchroom');
  const { isLoading } = useConvexAuth();

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="auth-screen">
      <header className="auth-nav">
        <a className="auth-wordmark" href="/" aria-label="Sketchroom home">
          <LogoGlyph />
          Sketchroom
        </a>
        <nav className="auth-nav-links" aria-label="Primary">
          <a className="auth-nav-link" href="/#product">Product</a>
          <a className="auth-nav-link" href="/#workflow">How it works</a>
          <a className="auth-nav-link" href="/#pricing">Pricing</a>
        </nav>
        <div className="auth-nav-cta">
          <a className="auth-nav-link auth-nav-signin" href="#join">Sign in</a>
          <a className="btn btn-primary auth-nav-start" href="#join">Start free</a>
        </div>
      </header>

      <main className="auth-hero">
        <section className="auth-showcase">
          <span className="auth-eyebrow">
            <span className="auth-eyebrow-dot" aria-hidden="true" />
            Realtime whiteboards for teams
          </span>
          <h1 className="auth-title">Think together, in the open.</h1>
          <p className="auth-lead">
            Sketch architecture, wireframes, and features with your team — live cursors,
            multiplayer undo, and an AI copilot that drafts ideas right in the room.
          </p>

          <div className="auth-cta-row">
            <SignInButton mode="modal">
              <button className="btn btn-primary auth-google" type="button">
                <span className="auth-google-mark"><GoogleGlyph size={11} /></span>
                Continue with Google
              </button>
            </SignInButton>
            <span className="auth-cta-note">Free to start · No credit card · AI copilot included</span>
          </div>

          <div className="auth-proof">
            <div className="auth-avatars" aria-hidden="true">
              <span className="auth-avatar">MK</span>
              <span className="auth-avatar">AJ</span>
              <span className="auth-avatar">SR</span>
              <span className="auth-avatar auth-avatar-ai">✦</span>
            </div>
            <p className="auth-proof-text">Your team, <strong>one live canvas</strong> — copilot included</p>
          </div>

          <div className="auth-demo">
            <DemoCanvas />
          </div>
        </section>

        <aside className="auth-card" id="join">
          <h2 className="auth-card-title">Join Sketchroom</h2>
          <p className="auth-card-sub">
            One click to start your first room — shared live with your team in seconds.
          </p>
          <SignInButton mode="modal">
            <button className="auth-google-btn" type="button">
              <GoogleGlyph size={18} />
              Continue with Google
            </button>
          </SignInButton>
          <div className="auth-card-divider" role="separator"><span>Secure sign-in</span></div>
          <p className="auth-card-small">
            OAuth only — no password to remember.<br />
            By continuing you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
          </p>
        </aside>
      </main>

      <footer className="auth-footer">
        <span>© 2026 Sketchroom</span>
        <span>Terms</span>
        <span>Privacy</span>
        <span>Status</span>
      </footer>
    </div>
  );
}
