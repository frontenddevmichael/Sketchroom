import { useEffect } from 'react';

/** Set the tab title for a route; restores the previous title on unmount. */
export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
