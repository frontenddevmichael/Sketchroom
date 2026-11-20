import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import './ui.css';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

/** Label + input + hint/error, wired with ids and aria-invalid. */
export function Field({ label, hint, error, id, className, ...rest }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? `ui-field-${autoId}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={['ui-field', className].filter(Boolean).join(' ')}>
      <label className="ui-field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        className="ui-field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
      />
      {error ? (
        <p className="ui-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p className="ui-field__hint" id={hintId}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}
