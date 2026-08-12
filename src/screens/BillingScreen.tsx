import { useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ArrowLeft, Check } from 'lucide-react';
import { PlanCardSkeleton } from '../components/skeletons';
import { LimitEmptyIllo, DrawnTitle } from '../components/illustrations';
import { AppTabBar } from '../components/AppTabBar';
import { usePageTitle } from '../lib/usePageTitle';
import '../components/skeletons.css';
import './BillingScreen.css';

const FREE_ROOM_LIMIT = 3;
const FREE_AI_LIMIT = 40;

const FREE_FEATURES = [
  'Up to 3 rooms',
  'Up to 3 collaborators per room',
  '40 AI suggestions per month',
  'Unlimited sketching',
];

const TEAM_FEATURES = [
  'Unlimited rooms',
  'Unlimited collaborators',
  'Unlimited AI suggestions',
  'Version history',
  'PNG / PDF export',
  'Priority support',
];

export function BillingScreen() {
  usePageTitle('Billing — Sketchroom');
  const navigate = useNavigate();
  const usage = useQuery(api.rooms.getUsage);

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
  // it gets a calm, non-punitive treatment with a clear path to upgrade.
  const atRoomLimit = usage.rooms >= FREE_ROOM_LIMIT;
  const atAiLimit = usage.aiSuggestions >= FREE_AI_LIMIT;

  return (
    <div className="billing-screen">
      <button className="billing-back" onClick={() => navigate('/dashboard')}>
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
              Nothing is locked — every room and sketch stays open. Upgrade to Team when you're ready for more room to think.
            </p>
          </div>
          <a className="btn btn-primary limit-reached-cta" href="/#faq" aria-label="See how to upgrade on the FAQ">
            How to upgrade
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
                <span className="plan-usage-fill" style={{ width: `${aiPct}%` }} />
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
          <h2 className="plan-name">Team</h2>
          <p className="plan-price">$8<span className="plan-period">/mo per seat</span></p>
          <ul className="plan-features">
            {TEAM_FEATURES.map((f) => (
              <li key={f}><Check size={15} />{f}</li>
            ))}
          </ul>
          <a
            className="btn btn-primary plan-upgrade"
            href="/#faq"
            aria-label="Find out how to upgrade on the FAQ"
          >
            How to upgrade
          </a>
        </div>
      </div>
    </div>
  );
}