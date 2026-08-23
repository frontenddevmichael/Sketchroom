import { useEffect, useRef } from 'react';

/**
 * A live region for announcing dynamic changes to screen readers.
 * Usage: const announce = useAnnouncer(); announce('Message to announce');
 */
export function LiveRegion() {
  const politeRef = useRef<HTMLDivElement | null>(null);
  const assertiveRef = useRef<HTMLDivElement | null>(null);

  // Expose announce via ref for parent components
  useEffect(() => {
    if (politeRef.current && assertiveRef.current) {
      (window as unknown as Record<string, unknown>).__sketchroomAnnounce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
        const ref = priority === 'assertive' ? assertiveRef : politeRef;
        if (ref.current) {
          ref.current.textContent = '';
          void ref.current.offsetWidth;
          ref.current.textContent = message;
        }
      };
    }
    return () => {
      delete (window as unknown as Record<string, unknown>).__sketchroomAnnounce;
    };
  }, []);

  return (
    <>
      <div
        ref={politeRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden' }}
      />
      <div
        ref={assertiveRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden' }}
      />
    </>
  );
}

export function useAnnouncer() {
  const politeRef = useRef<HTMLDivElement | null>(null);
  const assertiveRef = useRef<HTMLDivElement | null>(null);

  // Create live regions on first use
  useEffect(() => {
    if (!politeRef.current) {
      politeRef.current = document.createElement('div');
      politeRef.current.setAttribute('role', 'status');
      politeRef.current.setAttribute('aria-live', 'polite');
      politeRef.current.setAttribute('aria-atomic', 'true');
      politeRef.current.className = 'sr-only';
      politeRef.current.style.cssText = 'position: absolute; width: 1px; height: 1px; overflow: hidden;';
      document.body.appendChild(politeRef.current);
    }
    if (!assertiveRef.current) {
      assertiveRef.current = document.createElement('div');
      assertiveRef.current.setAttribute('role', 'alert');
      assertiveRef.current.setAttribute('aria-live', 'assertive');
      assertiveRef.current.setAttribute('aria-atomic', 'true');
      assertiveRef.current.className = 'sr-only';
      assertiveRef.current.style.cssText = 'position: absolute; width: 1px; height: 1px; overflow: hidden;';
      document.body.appendChild(assertiveRef.current);
    }
    return () => {
      politeRef.current?.remove();
      assertiveRef.current?.remove();
    };
  }, []);

  return (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const ref = priority === 'assertive' ? assertiveRef : politeRef;
    if (ref.current) {
      ref.current.textContent = '';
      void ref.current.offsetWidth;
      ref.current.textContent = message;
    }
  };
}

/* sr-only utility class (already in index.css but adding here for completeness) */
/*
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
*/