import type { ReactNode } from 'react';
import './ui.css';

/** A keyboard cap, for shortcut hints. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ui-kbd">{children}</kbd>;
}
