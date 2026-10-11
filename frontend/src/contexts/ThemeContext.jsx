import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);

const ACCENTS = { admin: 'indigo', guru: 'emerald', student: 'amber', parent: 'amber' };

function apply(mode, accent) {
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.setAttribute('data-accent', accent);
  root.style.colorScheme = mode;
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [accent, setAccent] = useState(() => localStorage.getItem('accent') || 'indigo');

  useEffect(() => {
    apply(mode, accent);
    localStorage.setItem('theme', mode);
    localStorage.setItem('accent', accent);
  }, [mode, accent]);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq || localStorage.getItem('theme')) return;
    const onChange = (e) => {
      setMode(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const value = useMemo(() => ({
    mode,
    accent,
    isDark: mode === 'dark',
    toggle: () => setMode(m => (m === 'dark' ? 'light' : 'dark')),
    setMode,
    setRole: (role) => setAccent(ACCENTS[role] || 'indigo'),
  }), [mode, accent]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
