'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type ThemeType = 'light' | 'dark';
type ThemeContextType = {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize with light theme by default
  const [theme, setTheme] = useState<ThemeType>('light');

  useEffect(() => {
    // Check for saved theme preference, otherwise default to light mode
    const savedTheme = localStorage.getItem('theme') as ThemeType;
    if (savedTheme) {
      setTheme(savedTheme);
    }
    // If no saved preference, keep the default light theme (no system preference check)
  }, []);

  useEffect(() => {
    // Update document class when theme changes
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
    
    // Save to localStorage
    localStorage.setItem('theme', theme);
    
    // Dispatch events so header updates (same as header implementation)
    window.dispatchEvent(new Event('themeChange'));
    window.dispatchEvent(new Event('storage'));
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
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