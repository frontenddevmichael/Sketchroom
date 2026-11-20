import type { ReactNode } from 'react';
import './ui.css';

export interface IconTileProps {
  icon: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}

/** A 48px tiled glyph with a label to its right (ref 2 bottom row). */
export function IconTile({ icon, label, description, className }: IconTileProps) {
  return (
    <div className={['ui-icon-tile', className].filter(Boolean).join(' ')}>
      <span className="ui-icon-tile__box" aria-hidden="true">
        {icon}
      </span>
      <span className="ui-icon-tile__text">
        <span className="ui-icon-tile__label">{label}</span>
        {description && <span className="ui-icon-tile__desc">{description}</span>}
      </span>
    </div>
  );
}
