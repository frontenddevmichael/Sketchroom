import { useEffect, useRef } from 'react';

/**
 * Keyboard discipline for modal surfaces: traps Tab inside the dialog,
 * closes on Escape, and returns focus to the trigger on close. Without this,
 * keyboard users can tab into the page behind an open modal and lose their
 * place entirely.
 */
export function useModalFocus<T extends HTMLElement>(onClose: () => void, active = true) {
  const ref = useRef<T | null>(null);
  const trigger = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    trigger.current = document.activeElement;

    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
    const first = focusables()[0];
    if (first) first.focus();
    else root.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (trigger.current instanceof HTMLElement) trigger.current.focus();
    };
  }, [active]);

  return ref;
}
