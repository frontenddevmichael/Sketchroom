import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Defers mounting `children` until the placeholder is near the viewport (root
 * margin pulls it 960px early). Used to keep heavy below-fold sections — and
 * their imports, like gsap — out of the initial bundle. Falls back to mounting
 * immediately when IntersectionObserver isn't available.
 */
export function LazyMount({
  children,
  minHeight,
  className,
}: {
  children: ReactNode;
  minHeight?: number | string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(
    typeof IntersectionObserver === 'undefined',
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '960px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  if (shown) return <>{children}</>;

  return (
    <div
      ref={ref}
      className={className}
      style={
        minHeight !== undefined
          ? { height: typeof minHeight === 'number' ? `${minHeight}px` : minHeight }
          : undefined
      }
      aria-hidden="true"
    />
  );
}