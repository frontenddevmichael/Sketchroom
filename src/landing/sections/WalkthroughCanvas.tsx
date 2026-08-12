import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';
import './WalkthroughCanvas.css';

/**
 * A lightweight, static-by-step canvas used by the scroll-driven walkthrough.
 * Unlike the hero DemoCanvas there is no ticking loop here: each step renders a
 * set of blocks/cursors/connectors in the shared 0-100 x 0-62.5 coordinate
 * space (percentages), and framer-motion fades between steps.
 */
export interface WBlock {
  id: string;
  kind: 'sticky' | 'rect' | 'ghost' | 'done';
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  rot?: number;
}

export interface WCursor {
  id: string;
  label: string;
  x: number;
  y: number;
  tone: 'gray' | 'dark' | 'green';
}

export interface WConnector {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed?: boolean;
}

interface WalkthroughCanvasProps {
  blocks: WBlock[];
  cursors: WCursor[];
  connectors: WConnector[];
  prompt?: string;
  bubble?: string;
  renderTopbar?: ReactNode;
}

export function WalkthroughCanvas({
  blocks,
  cursors,
  connectors,
  prompt,
  bubble,
  renderTopbar,
}: WalkthroughCanvasProps) {
  return (
    <div className="wc-window">
      <div className="wc-topbar">
        <div className="wc-room">
          <span className="wc-room-icon">P</span>
          <span className="wc-room-name">Planning room</span>
          {renderTopbar}
        </div>
        <div className="wc-share">Share</div>
      </div>

      <div className="wc-stage" aria-hidden="true">
        <div className="wc-empty-dot wc-dot-1" />
        <div className="wc-empty-dot wc-dot-2" />

        <AnimatePresence>
          {bubble && (
            <motion.div
              key="wc-bubble"
              className="wc-bubble"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.3 }}
            >
              {bubble}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {connectors.map((c) => (
            <motion.div
              key={c.id}
              className="wc-connector"
              style={{ left: `${c.x1}%`, top: `${c.y1}%`, width: `${Math.abs(c.x2 - c.x1)}%`, height: `${Math.abs(c.y2 - c.y1)}%` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <svg width="100%" height="100%" viewBox={`0 0 100 100`} preserveAspectRatio="none">
                <line
                  x1="0"
                  y1={c.y2 > c.y1 ? 0 : 100}
                  x2="100"
                  y2={c.y2 > c.y1 ? 100 : 0}
                  stroke="var(--neutral-400)"
                  strokeWidth="1.2"
                  strokeDasharray={c.dashed ? '4 6' : undefined}
                />
              </svg>
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {blocks.map((b) => (
            <motion.div
              key={b.id}
              className={`wc-block wc-block-${b.kind}`}
              style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`, transform: b.rot ? `rotate(${b.rot}deg)` : undefined }}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {b.kind === 'sticky' && <span className="wc-sticky-fold" />}
              <span className="wc-block-label">{b.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {cursors.map((c) => (
            <motion.div
              key={c.id}
              className={`wc-cursor wc-cursor-${c.tone}`}
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <svg width="14" height="17" viewBox="0 0 14 17" fill="none" aria-hidden="true">
                <path d="M0 0 L14 10.5 L8.5 8 L8 15 Z" fill="currentColor" />
              </svg>
              <span className="wc-cursor-label">{c.label}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {prompt !== undefined && (
          <motion.div className="wc-prompt" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <span className="wc-prompt-glyph">✦</span>
            <span className="wc-prompt-text">{prompt}</span>
            <span className="wc-prompt-caret" />
          </motion.div>
        )}
      </div>
    </div>
  );
}