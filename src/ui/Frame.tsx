import type { ReactNode } from 'react';
import './ui.css';

export interface FrameProps {
  children: ReactNode;
  /** Dashed gutter guides instead of solid column rules. */
  guides?: boolean;
  className?: string;
}

/**
 * The hairline column: content sits between two 1px vertical rules, with an
 * optional dashed guide outside them (refs 1 and 2).
 */
export function Frame({ children, guides = false, className }: FrameProps) {
  const classes = ['ui-frame', guides ? 'ui-frame--guides' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes}>
      <div className="ui-frame__body">{children}</div>
    </div>
  );
}

export interface SectionProps {
  title?: ReactNode;
  lead?: ReactNode;
  eyebrow?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** A section inside a Frame: eyebrow, title, lead, then content. */
export function Section({ title, lead, eyebrow, children, className }: SectionProps) {
  return (
    <section className={['ui-section', className].filter(Boolean).join(' ')}>
      {(eyebrow || title || lead) && (
        <div className="ui-section__head">
          {eyebrow}
          {title && <h2 className="ui-section__title">{title}</h2>}
          {lead && <p className="ui-section__lead">{lead}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Full-bleed hairline separator. */
export function Rule() {
  return <hr className="ui-rule" />;
}
