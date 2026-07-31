import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSiteTheme, updateSiteTheme } from '../services/settings';

// Single source of truth for which themes exist — each key must match a
// `[data-theme="..."]` block in index.css. Used by both the DOM-application
// effect below and the Admin theme picker, so adding a theme is one edit
// here plus one CSS block, nowhere else.
export const THEMES = [
  { key: 'civic-original', label: 'Civic original', mode: 'dark' },
  { key: 'electric-blue', label: 'Electric blue', mode: 'dark' },
  { key: 'vibrant-indigo', label: 'Vibrant indigo', mode: 'dark' },
  { key: 'fresh-green', label: 'Fresh green', mode: 'dark' },
  { key: 'sunset-coral', label: 'Sunset coral', mode: 'dark' },
  { key: 'bold-orange', label: 'Bold orange', mode: 'dark' },
  { key: 'crimson-attention', label: 'Crimson attention', mode: 'dark' },
  { key: 'clean-sky-blue', label: 'Clean sky blue', mode: 'light' },
  { key: 'soft-mint', label: 'Soft mint', mode: 'light' },
  { key: 'warm-coral', label: 'Warm coral', mode: 'light' },
  { key: 'soft-lavender', label: 'Soft lavender', mode: 'light' },
  { key: 'sky-cyan', label: 'Sky cyan', mode: 'light' },
  { key: 'peach-amber', label: 'Peach amber', mode: 'light' },
];

const ThemeContext = createContext();

// "civic-original" is the app's :root default in index.css, so it's applied
// by simply having no data-theme attribute at all -- every other key maps
// to a same-named [data-theme="..."] override block.
function applyTheme(key) {
  if (!key || key === 'civic-original') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', key);
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('civic-original');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSiteTheme().then(({ data }) => {
      if (!active) return;
      const key = data?.theme || 'civic-original';
      setThemeState(key);
      applyTheme(key);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  // Optimistic: applies immediately so the admin sees the switch happen,
  // then persists. If the write fails (e.g. lost admin session), the DOM
  // still reflects the last successfully-read theme on next reload.
  const setTheme = async (key) => {
    setThemeState(key);
    applyTheme(key);
    await updateSiteTheme(key);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  return useContext(ThemeContext);
};
