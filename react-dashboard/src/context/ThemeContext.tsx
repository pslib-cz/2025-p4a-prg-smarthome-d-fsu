import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

interface ThemeState {
  theme: Theme;
  manualOverride: boolean;
}

const STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getInitialThemeState = (): ThemeState => {
  if (typeof window === 'undefined') {
    return { theme: 'light', manualOverride: false };
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return { theme: stored, manualOverride: true };
  }

  const prefersDark = window.matchMedia?.(DARK_QUERY).matches;
  return { theme: prefersDark ? 'dark' : 'light', manualOverride: false };
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(getInitialThemeState);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (state.manualOverride) {
      window.localStorage.setItem(STORAGE_KEY, state.theme);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [state.manualOverride, state.theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia(DARK_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setState(prev => {
        if (prev.manualOverride) {
          return prev;
        }
        return { ...prev, theme: event.matches ? 'dark' : 'light' };
      });
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const toggleTheme = () => {
    setState(prev => ({
      theme: prev.theme === 'light' ? 'dark' : 'light',
      manualOverride: true,
    }));
  };

  return (
    <ThemeContext.Provider value={{ theme: state.theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
