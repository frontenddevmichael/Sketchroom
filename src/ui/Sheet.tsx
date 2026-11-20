import type { ReactNode } from 'react';
import './ui.css';

export interface SheetProps {
  children: ReactNode;
  title?: ReactNode;
  /** Right-aligned header content (a Tag, a count, an action). */
  meta?: ReactNode;
  flush?: boolean;
  className?: string;
}

/** A hairline-bordered surface. Sheets are the only container in the system. */
export function Sheet({ children, title, meta, flush = false, className }: SheetProps) {
  const classes = ['ui-sheet', flush ? 'ui-sheet--flush' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <section className={classes}>
      {(title || meta) && (
        <header className="ui-sheet__head">
          {title && <h3 className="ui-sheet__title">{title}</h3>}
          {meta}
        </header>
      )}
      {children}
    </section>
  );
}
