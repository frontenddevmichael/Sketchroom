import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usePageTitle } from '../lib/usePageTitle';
import './LegalScreen.css';

const SECTIONS = {
  terms: {
    title: 'Terms of Service',
    updated: 'August 13, 2026',
    intro:
      'These terms cover your use of Sketchroom. They are short on purpose — if a question is not answered here, ask us.',
    blocks: [
      {
        h: 'Your work stays yours',
        p: 'Everything you sketch, write, or import into a room is your content. Sketchroom does not claim ownership of it, and we only use it to run the service you signed up for. You keep every right to your work and can export it to PNG, PDF, or SVG at any time.',
      },
      {
        h: 'What you agree not to do',
        p: 'Do not use Sketchroom to do anything unlawful, upload content you do not have the right to share, harass other people, attempt to break into accounts or systems, or try to degrade the service for others. We can suspend or remove accounts that abuse the product.',
      },
      {
        h: 'Your account and security',
        p: 'You are responsible for keeping your credentials safe. Passwords are stored Scrypt-hashed by Convex Auth, never in plaintext. If you believe someone else has accessed your account, reset your password or contact us right away.',
      },
      {
        h: 'The free plan',
        p: 'The free plan allows 3 rooms, 3 collaborators per room, and 40 AI suggestions per month. These limits are enforced server-side. Hitting a limit never deletes or locks your rooms — your work stays open and editable.',
      },
      {
        h: 'The AI copilot',
        p: 'Copilot suggestions are generated from the prompt you write and the shapes you have selected — it does not read your whole room. AI output can be wrong, so treat every suggestion as a draft to review before it becomes part of your plan.',
      },
      {
        h: 'Deleting your data',
        p: 'You can delete any room you own, and delete your workspace from Settings. Deletion removes the room and its snapshots, messages, and membership data. You can also sign out or stop using the service at any time.',
      },
      {
        h: 'Availability',
        p: 'We aim to keep Sketchroom up and dependable, but we do not guarantee uninterrupted or error-free service. You use the service as it is.',
      },
      {
        h: 'Changes to these terms',
        p: 'If we change these terms in a way that affects you, we will let you know inside the product before the change takes effect. Continued use of Sketchroom after a change means you accept the updated terms.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'August 13, 2026',
    intro:
      'This policy explains what data Sketchroom collects, what we do with it, and the choices you have. We collect the minimum needed to make the product work.',
    blocks: [
      {
        h: 'What we collect',
        p: 'Account details (name, email, optional avatar), the content you create in rooms (canvas state, snapshots, AI chat), presence signals so collaborators can see who is active, and anonymous error reports when something breaks.',
      },
      {
        h: 'How we use it',
        p: 'To show you your rooms and canvases, to keep collaborators in sync in real time, to power the AI copilot with only the context you choose, and to diagnose and fix problems.',
      },
      {
        h: 'Sign-in providers',
        p: 'You can sign in with email and password, stored Scrypt-hashed by Convex Auth. When Google sign-in is enabled on your workspace, we receive the profile information Google shares with us. Verification and password-reset codes are delivered by email.',
      },
      {
        h: 'Services we use',
        p: 'Canvases and account data are hosted by Convex. AI suggestions are generated through OpenRouter using the model your workspace owner configures. Transactional email (verification and reset codes) is sent through Resend.',
      },
      {
        h: 'The AI copilot context',
        p: 'When you ask the copilot for a suggestion, only your prompt and any shapes you have selected are sent as context. The full room is never sent, and every proposed sketch is a suggestion you review before it reaches the canvas.',
      },
      {
        h: 'Retention',
        p: 'Rooms keep up to 60 snapshots. The chat keeps the most recent 50 messages per room. Presence fades out shortly after someone stops being active. Deleting a room or workspace removes its data.',
      },
      {
        h: 'What we do not do',
        p: 'We do not sell your data. We do not run ad networks. We do not read your canvases beyond what the service needs to function and to keep you within the free-plan limits.',
      },
      {
        h: 'Your choices',
        p: 'You can export your work at any time, delete your rooms and workspace, change your display name, and sign out. To ask about your data or request a copy, contact us and we will help.',
      },
      {
        h: 'Changes to this policy',
        p: 'If this policy changes, we will notify you in the product. The date at the top of this page always reflects the latest version.',
      },
    ],
  },
} as const;

export function LegalScreen({ page }: { page: 'terms' | 'privacy' }) {
  usePageTitle(`${SECTIONS[page].title} — Sketchroom`);
  const doc = SECTIONS[page];

  return (
    <div className="legal-screen">
      <div className="legal-grid-bg" aria-hidden="true" />
      <header className="legal-topbar">
        <Link to="/" className="legal-home" aria-label="Sketchroom home">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l1.9 5.6L19.5 10l-4.5 2.1L12 18l-3-5.9L4.5 10l5.6-1.4z" fill="var(--green-500)" stroke="var(--green-500)" />
          </svg>
          <span className="legal-wordmark">Sketchroom</span>
        </Link>
        <Link to="/" className="legal-back">
          <ArrowLeft size={14} aria-hidden="true" />
          Back to home
        </Link>
      </header>

      <main className="legal-main">
        <article className="legal-doc">
          <p className="legal-updated">Last updated {doc.updated}</p>
          <h1 className="legal-title">{doc.title}</h1>
          <p className="legal-intro">{doc.intro}</p>
          {doc.blocks.map((block) => (
            <section key={block.h} className="legal-block">
              <h2 className="legal-block-h">{block.h}</h2>
              <p className="legal-block-p">{block.p}</p>
            </section>
          ))}
          <p className="legal-contact">
            Questions? Email{' '}
            <a href="mailto:hello@sketchroom.app" className="legal-mail">
              hello@sketchroom.app
            </a>
            .
          </p>
        </article>
      </main>

      <footer className="legal-footer">
        <span>© {new Date().getFullYear()} Sketchroom</span>
        <Link to="/terms" className="legal-footer-link">Terms</Link>
        <Link to="/privacy" className="legal-footer-link">Privacy</Link>
      </footer>
    </div>
  );
}
