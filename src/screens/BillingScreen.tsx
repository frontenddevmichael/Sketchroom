import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ArrowLeft, ArrowRight, Check, ChevronDown } from 'lucide-react';
import { PlanCardSkeleton } from '../components/skeletons';
import { LimitEmptyIllo, DrawnTitle } from '../components/illustrations';
import { AppTabBar } from '../components/AppTabBar';
import { usePageTitle } from '../lib/usePageTitle';
import { FREE_ROOM_LIMIT, FREE_AI_LIMIT } from '../lib/plans';
import '../components/skeletons.css';
import './BillingScreen.css';

const FREE_FEATURES = [
  'Up to 3 rooms',
  'Up to 3 collaborators per room',
  '40 AI suggestions per month',
  'Unlimited sketching',
  'Version history',
  'PNG / PDF / SVG export',
];

const TEAM_FEATURES = [
  'Unlimited rooms',
  'Unlimited collaborators',
  'Unlimited AI suggestions',
  'Priority support',
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'When can I upgrade to Team?',
    a: 'The Team plan is on its way — it will unlock unlimited rooms, collaborators, and AI suggestions. Until it ships, everyone is on the free plan, and no paid feature is locked behind a paywall.',
  },
  {
    q: 'What happens to my rooms if I hit the free limits?',
    a: 'Nothing is deleted. Rooms stay open and editable; you just can\u2019t create new ones (or generate more AI suggestions this month) until the allowance refreshes or Team ships.',
  },
  {
    q: 'Do AI suggestions roll over?',
    a: 'No — the 40 suggestion allowance resets at the start of each calendar month. Team will give you unlimited suggestions.',
  },
  {
    q: 'Is export or version history locked?',
    a: 'No. Version history and PNG / PDF / SVG export are available on the free plan — your work is never held hostage.',
  },
];

export function BillingScreen() {
  usePageTitle('Billing — Sketchroom');
  const navigate = useNavigate();
  const usage = useQuery(api.rooms.getUsage);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  if (!usage) {
    return (
      <div className="billing-screen" aria-label="Loading plans">
        <div className="skel skel-settings-back" aria-hidden="true" />
        <div className="skel skel-line skel-billing-title" aria-hidden="true" />
        <div className="skel skel-line skel-billing-sub" aria-hidden="true" />
        <div className="billing-plans">
          <PlanCardSkeleton index={0} />
          <PlanCardSkeleton index={1} />
        </div>
      </div>
    );
  }

  const roomPct = Math.min(100, (usage.rooms / FREE_ROOM_LIMIT) * 100);
  const aiPct = Math.min(100, (usage.aiSuggestions / FREE_AI_LIMIT) * 100);
  // A reached cap is a moment of its own — neither an error nor "empty" — so
  // it gets a calm, non-punitive treatment with a clear answer about what
  // comes next.
  const atRoomLimit = usage.rooms >= FREE_ROOM_LIMIT;
  const atAiLimit = usage.aiSuggestions >= FREE_AI_LIMIT;

  return (
    <div className="billing-screen">
      <button className="billing-back" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard">
        <ArrowLeft size={18} />
      </button>
      <AppTabBar />
      <h1 className="billing-title">Plans</h1>
      <p className="billing-subtitle">Sketch with your team. Upgrade when you need more room to think.</p>

      {(atRoomLimit || atAiLimit) && (
        <div className="limit-reached" role="note">
          <div className="limit-reached-illo" aria-hidden="true">
            <LimitEmptyIllo />
          </div>
          <div className="limit-reached-copy">
            <DrawnTitle className="limit-reached-title" delay={650}>
              {atRoomLimit && atAiLimit
                ? "You've reached the free-plan limits"
                : atRoomLimit
                  ? "You've reached the free room limit"
                  : "You've reached the free AI limit"}
            </DrawnTitle>
            <p className="limit-reached-text">
              Nothing is locked — every room and sketch stays open. The Team plan will lift these limits when it ships.
            </p>
          </div>
          <a className="btn btn-primary limit-reached-cta" href="#faq" aria-label="See the Team plan FAQ">
            Team plan FAQ
          </a>
        </div>
      )}

      <div className="billing-plans">
        <div className="plan-card plan-free">
          <h2 className="plan-name">Free</h2>
          <p className="plan-price">$0<span className="plan-period">/mo</span></p>
          <div className="plan-usage">
            <div className="plan-usage-row">
              <span>Rooms</span>
              <div className="plan-usage-bar">
                <span className="plan-usage-fill" style={{ width: `${roomPct}%` }} />
              </div>
              <span className="plan-usage-count">{usage.rooms} / {FREE_ROOM_LIMIT}</span>
            </div>
            <div className="plan-usage-row">
              <span>AI suggestions</span>
              <div className="plan-usage-bar">
                <span className="plan-usage-fill plan-usage-fill-ai" style={{ width: `${aiPct}%` }} />
              </div>
              <span className="plan-usage-count">{usage.aiSuggestions} / {FREE_AI_LIMIT}</span>
            </div>
          </div>
          <ul className="plan-features">
            {FREE_FEATURES.map((f) => (
              <li key={f}><Check size={15} />{f}</li>
            ))}
          </ul>
          <button className="plan-current" disabled>Current plan</button>
        </div>

        <div className="plan-card plan-team">
          <span className="plan-recommended">Coming soon</span>
          <h2 className="plan-name">Team</h2>
          <p className="plan-price plan-price-soon">Unlimited<span className="plan-period">when it ships</span></p>
          <ul className="plan-features">
            {TEAM_FEATURES.map((f) => (
              <li key={f}><Check size={15} />{f}</li>
            ))}
          </ul>
          <p className="plan-coming-soon">
            The Team plan is on its way. Until then, every feature — including
            version history and export — is available on the free plan.
          </p>
        </div>
      </div>

      <section className="billing-compare" aria-label="Plan comparison">
        <h2 className="billing-section-title">Compare plans</h2>
        <table className="billing-compare-table">
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col">Free</th>
              <th scope="col">Team</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Rooms</th>
              <td>{FREE_ROOM_LIMIT}</td>
              <td>Unlimited ✓</td>
            </tr>
            <tr>
              <th scope="row">Collaborators per room</th>
              <td>3</td>
              <td>Unlimited ✓</td>
            </tr>
            <tr>
              <th scope="row">AI suggestions</th>
              <td>{FREE_AI_LIMIT} / month</td>
              <td>Unlimited ✓</td>
            </tr>
            <tr>
              <th scope="row">Version history</th>
              <td>Included ✓</td>
              <td>Included ✓</td>
            </tr>
            <tr>
              <th scope="row">PNG / PDF / SVG export</th>
              <td>Included ✓</td>
              <td>Included ✓</td>
            </tr>
            <tr>
              <th scope="row">Support</th>
              <td>Community</td>
              <td>Priority ✓</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="billing-faq" id="faq" aria-label="Frequently asked questions">
        <h2 className="billing-section-title">Billing questions</h2>
        <div className="billing-faq-list">
          {FAQS.map((faq, i) => {
            const open = openFaq === i;
            return (
              <div key={faq.q} className={`billing-faq-item${open ? ' open' : ''}`}>
                <button
                  className="billing-faq-question"
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? null : i)}
                >
                  <span>{faq.q}</span>
                  <ChevronDown size={16} className="billing-faq-chevron" />
                </button>
                {open && <p className="billing-faq-answer">{faq.a}</p>}
              </div>
            );
          })}
        </div>
        <a className="billing-upgrade-link" href="#faq">
          Team plan FAQ
          <ArrowRight size={14} />
        </a>
      </section>
    </div>
  );
}
