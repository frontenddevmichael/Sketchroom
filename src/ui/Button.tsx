import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ui.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** The primary action carries an arrow that slides on hover (ref 2). */
  arrow?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

/**
 * The single action primitive. Primary is ink-filled and carries the arrow;
 * everything else is text or hairline, per the Blueprint language. `loading`
 * keeps the button's width stable and disables it, so a double submit cannot
 * slip through.
 */
export function Button({
  variant = 'primary',
  arrow = variant === 'primary',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['ui-btn', `ui-btn--${variant}`, className].filter(Boolean).join(' ');
  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <span className="ui-btn__spinner" aria-hidden="true" />}
      {children}
      {arrow && !loading && (
        <span className="ui-btn__arrow" aria-hidden="true">
          →
        </span>
      )}
    </button>
  );
}
