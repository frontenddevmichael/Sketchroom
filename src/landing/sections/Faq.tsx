import { useState } from 'react';
import { Reveal } from '../components/Reveal';
import './Faq.css';

/**
 * FAQ: the questions people actually hesitate on before adopting a planning
 * tool — security, pricing surprises, adoption, and what happens to their
 * work. Each answer is honest about what the product does today; no template
 * filler, no hype.
 */
const FAQS = [
  {
    q: 'Is our data secure?',
    a: 'Sign-in is OAuth-only through Clerk — no passwords for us to lose. Every room checks membership on each request, so only people you invite can open it. Your canvases live in Convex, and invites are explicit: by email or a link you create yourself.',
  },
  {
    q: 'Will I be charged later without warning?',
    a: 'No. The free plan stays free, and starting requires no credit card. If you ever hit a limit, nothing locks — your rooms stay open and editable. Upgrading is a choice, not an ambush.',
  },
  {
    q: 'What happens to my sketches if I stop paying?',
    a: 'Nothing happens to them. Rooms stay open, and you can export any canvas to PNG, PDF, or SVG at any time — your work is never held hostage.',
  },
  {
    q: 'Will my team actually use this?',
    a: 'No install, no setup — it opens in the browser. Live cursors mean you see a teammate the moment they join, and the copilot drafts a first pass for anything you ask, so there is always a starting point instead of a blank page.',
  },
  {
    q: 'What does the AI copilot see?',
    a: 'Only what you ask it to work with. When you select shapes, those are shared as context along with your prompt — it never reads the whole room. Every sketch it proposes is a suggestion you review before anything lands on the canvas.',
  },
  {
    q: 'Can I work alone?',
    a: 'Yes, comfortably. Working solo stays quiet — no empty-state fanfare. Focus mode dims everything but your selection for deep work, and the copilot is a one-on-one partner whenever you want one.',
  },
  {
    q: 'Do I need to install anything?',
    a: 'No. Sketchroom runs in any modern browser — nothing to download, nothing to update.',
  },
  {
    q: 'How do I get more rooms or seats?',
    a: 'The free plan covers 3 rooms and 3 collaborators per room — enough to pilot with a small team. The Team plan is on its way; when it ships it will unlock unlimited rooms, collaborators, and AI suggestions. Until then, if you need more room to work, write to us from the billing screen and we will set you up.',
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="landing-section faq" id="faq">
      <Reveal>
        <div className="landing-section-head faq-head">
          <span className="landing-eyebrow">Before you ask</span>
          <h2 className="landing-section-title">The honest answers</h2>
        </div>
      </Reveal>

      <div className="faq-list">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={item.q} delay={Math.min(i * 0.05, 0.2)}>
              <div className={`faq-item ${isOpen ? 'open' : ''}`}>
                <button
                  className="faq-question"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${i}`}
                >
                  <span>{item.q}</span>
                  <span className="faq-icon" aria-hidden="true" />
                </button>
                <div
                  id={`faq-answer-${i}`}
                  className="faq-answer"
                  role="region"
                  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                >
                  <div className="faq-answer-inner">
                    <p>{item.a}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
