import type { ReactNode } from 'react';
import './ui.css';

export interface TagProps {
  children: ReactNode;
  /** Solid hairline instead of dotted, for non-annotation use. */
  solid?: boolean;
  /** Full ink border — the "this is live/real" variant. */
  accent?: boolean;
  className?: string;
}

/**
 * The dotted mono annotation chip from the references: used as a hero eyebrow,
 * a section label, and callouts ("3 cursors live").
 */
export function Tag({ children, solid = false, accent = false, className }: TagProps) {
  const classes = [
    'ui-tag',
    solid ? 'ui-tag--solid' : '',
    accent ? 'ui-tag--accent' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <span className={classes}>{children}</span>;
}
