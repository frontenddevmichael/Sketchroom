import { useState } from 'react';
import type { RefObject } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { X, Sparkles, RefreshCw, Plus, LayoutGrid, Send } from 'lucide-react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import type { Editor } from 'tldraw';
import type { AiCopilot } from '../lib/useAiCopilot';
import { useLongLoad } from '../hooks/useLongLoad';
import { Spinner } from './Spinner';
import { ListRowSkeleton } from './skeletons';
import { AiEmptyIllo, DrawnTitle } from './illustrations';
import {
  AI_REFINE_SUGGESTIONS,
  ghostKindColor,
  insertFullDiagram,
  insertGhostBlock,
  parseAiDiagram,
} from '../lib/useAiCopilot';
import { kindIcon } from '../lib/blockKinds';
import { emitPlacementPulse } from './placementPulse';
import './AiFeed.css';

// After an AI insert lands, flash a green spring ring around the new blocks
// (green is the AI's reserved color) — a placement moment, not a teleport.
function pulseAiPlacement(editor: Editor) {
  const bounds = editor.getSelectionPageBounds();
  if (!bounds) return;
  const cam = editor.getCamera();
  emitPlacementPulse(
    {
      x: (bounds.x - cam.x) * cam.z,
      y: (bounds.y - cam.y) * cam.z,
      w: bounds.w * cam.z,
      h: bounds.h * cam.z,
    },
    'ai'
  );
}

interface AiFeedProps {
  copilot: AiCopilot;
  roomId: Id<'rooms'>;
  editor: Editor | null;
  readOnly?: boolean;
  /** Ref into the bar's prompt input, so global shortcuts (⌘K) can focus it. */
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Ref into the bar itself, so first-run coachmarks can target it. */
  barRef?: RefObject<HTMLDivElement | null>;
  /** Whether a completed suggestion hasn't been viewed yet — drives the pulse. */
  unviewed?: boolean;
}

export function AiFeed({
  copilot,
  roomId,
  editor,
  readOnly = false,
  inputRef,
  barRef,
  unviewed = false,
}: AiFeedProps) {
  const { user } = useCurrentUser();
  const messages = useQuery(api.ai.getAiMessages, { roomId });
  const dismissAi = useMutation(api.ai.dismissAiSuggestion);
  const requestAi = useAction(api.ai.requestAiSuggestion);
  const [error, setError] = useState<string | null>(null);
  // First-use vs. after-use empty copy: the moment you ask once, the empty
  // state stops being "discover me" and becomes "ready for more".
  const [hasAsked] = useState(() => {
    try {
      return localStorage.getItem('sketchroom.aiAsked.v1') === '1';
    } catch {
      return false;
    }
  });

  const ask = () => {
    try {
      localStorage.setItem('sketchroom.aiAsked.v1', '1');
    } catch {
      // ignore
    }
    void copilot.handleAsk();
  };

  const showFeed =
    copilot.feedOpen ||
    copilot.isAsking ||
    (messages && messages.length > 0 && messages[messages.length - 1]?.status === 'pending');

  const retry = (promptText: string) => {
    requestAi({ roomId, prompt: promptText }).catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not retry.')
    );
  };

  return (
    <div className="ai-stack">
      {showFeed && (
        <aside
          className="ai-chat glass"
          role="complementary"
          aria-label="AI Copilot"
        >
          <header className="ai-chat-header">
            <div className="ai-feed-title">
              <Sparkles size={15} className="ai-feed-icon" />
              <span>AI Copilot</span>
            </div>
            <button className="ai-feed-close" onClick={copilot.closeFeed} aria-label="Collapse AI chat">
              <X size={16} />
            </button>
          </header>

          <div className="ai-feed-body">
            {messages === undefined && (
              <div className="ai-feed-skel" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <ListRowSkeleton key={i} index={i} thumb={false} />
                ))}
              </div>
            )}

            {messages && messages.length === 0 && (
              <div className="ai-feed-empty">
                <AiEmptyIllo />
                <DrawnTitle className="ai-feed-empty-title" delay={600}>
                  {hasAsked ? 'Ready when you are' : 'Ask me anything'}
                </DrawnTitle>
                <p className="ai-feed-empty-text">
                  {hasAsked
                    ? 'Dismissed suggestions stay dismissed. Start a new prompt, or select shapes on the canvas and I\'ll refine them.'
                    : 'Ask me to draft an architecture, spot missing steps in a flow, or propose a wireframe.'}
                </p>
              </div>
            )}

            {messages?.map((msg) => {
              const diagram = parseAiDiagram(msg.ghostBlocks);
              const blocks = diagram?.blocks ?? [];
              const edges = diagram?.edges ?? [];
              return (
                <div key={msg._id} className="ai-message">
                  <div className="ai-message-prompt">
                    {user && <span className="ai-message-author">{user.name?.[0] ?? 'You'}</span>}
                    {msg.prompt}
                  </div>
                  {msg.status === 'pending' && <AiThinking />}
                  {msg.status === 'failed' && (
                    <div className="ai-message-error">
                      <p>{msg.response}</p>
                      <div className="ai-message-error-actions">
                        <button className="ai-text-link" onClick={() => retry(msg.prompt)}>
                          <RefreshCw size={12} />
                          Try again
                        </button>
                        <button
                          className="ai-text-link"
                          onClick={() => dismissAi({ messageId: msg._id }).catch(() => setError('Could not dismiss.'))}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                  {msg.status === 'completed' && (
                    <>
                      <p className="ai-message-response">{msg.response}</p>
                      {blocks.length > 0 && !readOnly && editor && (
                        <div className="ai-insert-all-row">
                          <button
                            className="ai-insert-all"
                            onClick={() => {
                              insertFullDiagram(editor, { blocks, edges }, () => copilot.setInserted('all'));
                              pulseAiPlacement(editor);
                            }}
                          >
                            <LayoutGrid size={14} />
                            {copilot.inserted === 'all'
                              ? 'Added to canvas'
                              : `Insert all · ${blocks.length} block${blocks.length > 1 ? 's' : ''}${edges.length > 0 ? ` + ${edges.length} arrow${edges.length > 1 ? 's' : ''}` : ''}`}
                          </button>
                        </div>
                      )}
                      {blocks.length > 0 && (
                        <div className="ai-ghost-block-list">
                          {blocks.map((block, i) => {
                            const KindIcon = kindIcon(block.kind);
                            return (
                              <div key={i} className="ai-ghost-block">
                                <span className={`ai-ghost-kind ai-ghost-kind-${ghostKindColor(block.kind)}`}>
                                  <KindIcon size={10} />
                                  {block.kind}
                                </span>
                                <span className="ai-ghost-label">{block.label}</span>
                                <span className="ai-ghost-actions">
                                  {!readOnly && editor && (
                                    <button
                                      className="ai-text-link"
                                      title="Place on canvas"
                                      onClick={() => {
                                        insertGhostBlock(editor, blocks, i, (label) => copilot.setInserted(label));
                                        pulseAiPlacement(editor);
                                      }}
                                    >
                                      <Plus size={12} />
                                      {copilot.inserted === block.label ? 'Added' : 'Insert'}
                                    </button>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {(error || copilot.error) && (
              <div className="ai-feed-error" role="alert">
                <p>{error ?? copilot.error}</p>
              </div>
            )}
          </div>
        </aside>
      )}

      {copilot.selectedCount > 0 && !showFeed && (
        <div className="ai-refine-bar glass" role="region" aria-label="Selection-aware AI">
          <span className="ai-refine-count">{copilot.selectedCount}</span>
          <span className="ai-refine-text">
            selected shape{copilot.selectedCount > 1 ? 's' : ''} will guide the sketch
          </span>
          <button className="ai-refine-clear" onClick={copilot.clearSelection}>
            Clear
          </button>
          <div className="ai-refine-chips">
            {AI_REFINE_SUGGESTIONS.map((s) => (
              <button key={s} className="ai-refine-chip" onClick={() => copilot.setPrompt(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="ai-bar glass" ref={barRef} role="search" aria-label="Ask Sketchroom AI">
        <Sparkles
          size={18}
          className={`ai-bar-icon ${unviewed ? 'unviewed' : ''}`}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          className="ai-bar-input"
          placeholder={
            copilot.selectedCount > 0
              ? 'Refine the selected shapes…'
              : readOnly
                ? 'View-only room — AI is off'
                : 'Ask Sketchroom AI…'
          }
          value={copilot.prompt}
          onChange={(e) => {
            setError(null);
            copilot.setPrompt(e.target.value);
          }}
          onFocus={() => {
            setError(null);
            copilot.openFeed();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') ask();
          }}
          disabled={readOnly}
          aria-label="Ask Sketchroom AI"
        />
        <button
          className="ai-bar-send"
          onClick={ask}
          disabled={!copilot.prompt.trim() || copilot.isAsking || readOnly}
          aria-label="Send message"
          title="Send (Enter)"
        >
          {copilot.isAsking ? <Spinner size={16} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}

// The AI's thinking state is anticipation for a specific answer — not a page
// load — so it gets its own identity: the sparkle pulsing with expanding
// spring rings (the same pulse signature as the unviewed-suggestion cue),
// with copy that breathes instead of a frozen spinner. The brand spinner
// stays reserved for the lightweight send action itself.
function AiThinking() {
  const { phrase } = useLongLoad(
    true,
    ['Thinking…', 'Sketching it out…', 'Almost there…'],
    4000
  );
  return (
    <div className="ai-message-thinking" role="status">
      <span className="ai-thinking-mark" aria-hidden="true">
        <Sparkles size={13} />
        <span className="ai-thinking-ring" />
      </span>
      <span key={phrase} className="ai-thinking-copy">
        {phrase}
      </span>
    </div>
  );
}
