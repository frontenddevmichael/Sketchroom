import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ThemeContext } from './theme-context';
import type { Theme } from './theme-context';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme] = useState<Theme>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {};
  const setTheme = () => {};

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
